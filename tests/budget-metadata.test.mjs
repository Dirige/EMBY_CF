import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createFetchBudget } from '../src/shared/proxy/budget.js';
import { rewriteJsonResponse } from '../src/shared/proxy/json-rewrite.js';
import { loadEdition, fixture } from './helpers.mjs';

test('fetch budget bounds total attempts and total header deadline', async () => {
  const original = globalThis.fetch;
  let now = 0, calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('test'); };
  try {
    const request = new Request('https://proxy.test/');
    const budget = createFetchBudget(request, { maxRequests: 2, totalMs: 20, clock: () => now });
    await (await budget.fetch('https://one.test/')).body.cancel();
    await (await budget.fetch('https://two.test/')).body.cancel();
    await assert.rejects(budget.fetch('https://three.test/'), /budget exhausted/);
    const timed = createFetchBudget(request, { totalMs: 10, clock: () => now });
    now = 11;
    await assert.rejects(timed.fetch('https://one.test/'), /budget exhausted/);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test('fetch header timeout aborts a stalled origin', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = req => new Promise((resolve, reject) => req.signal.addEventListener('abort', () => reject(req.signal.reason), { once: true }));
  try {
    const budget = createFetchBudget(new Request('https://proxy.test/'), { headerMs: 5 });
    await assert.rejects(budget.fetch('https://origin.test/'), /timeout/i);
  } finally { globalThis.fetch = original; }
});

test('response-header timer never cuts off a long-lived media body', async () => {
  const original = globalThis.fetch;
  let upstreamRequest, source;
  globalThis.fetch = async req => {
    upstreamRequest = req;
    return new Response(new ReadableStream({ start(c) { source = c; } }));
  };
  try {
    const budget = createFetchBudget(new Request('https://proxy.test/'), { headerMs: 5 });
    const response = await budget.fetch('https://origin.test/');
    await delay(20);
    assert.equal(upstreamRequest.signal.aborted, false);
    source.enqueue(new TextEncoder().encode('late media')); source.close();
    assert.equal(await response.text(), 'late media');
  } finally { globalThis.fetch = original; }
});

test('bounded JSON rewrite changes only small valid matching metadata', async () => {
  const original = new Response('{"url":"old"}', { headers: { 'Content-Type': 'application/json', 'ETag': 'old-etag', 'Content-Length': '13' } });
  const response = await rewriteJsonResponse(original, data => { data.url = 'new'; return true; });
  assert.equal((await response.json()).url, 'new');
  assert.equal(response.headers.get('ETag'), null);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  for (const text of ['invalid JSON', '{ "unchanged": true }']) {
    const passthrough = await rewriteJsonResponse(new Response(text), () => false);
    assert.equal(await passthrough.text(), text);
  }
});

test('large or compressed declared metadata is never read for rewriting', async () => {
  for (const headers of [{ 'Content-Length': '100' }, { 'Content-Encoding': 'gzip' }]) {
    let pulled = false;
    const response = new Response(new ReadableStream({ pull() { pulled = true; } }, { highWaterMark: 0 }), { headers });
    const result = await rewriteJsonResponse(response, () => { throw new Error('Must not rewrite'); }, { limit: 10 });
    assert.equal(result, response);
    assert.equal(pulled, false);
    await result.body.cancel();
  }
});

test('unknown metadata overflow passes its original byte stream without tee/truncation', async () => {
  const body = new Uint8Array(50).fill(42);
  const response = await rewriteJsonResponse(new Response(body), () => { throw new Error('Must not rewrite'); }, { limit: 10 });
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), body);
});

test('metadata timeout cancels the origin instead of leaving a clone running', async () => {
  let cancelled = false;
  const response = await rewriteJsonResponse(new Response(new ReadableStream({ cancel() { cancelled = true; } })), () => true, { timeoutMs: 5 });
  assert.equal(response.status, 502);
  assert.equal(cancelled, true);
});

test('metadata rewrite concurrency is bounded without queueing new playback requests', async () => {
  const sources = [];
  const pending = Array.from({ length: 4 }, () => rewriteJsonResponse(new Response(new ReadableStream({ start(c) { sources.push(c); } })), () => false));
  const extra = new Response('unmodified');
  assert.equal(await rewriteJsonResponse(extra, () => true), extra);
  for (const source of sources) { source.enqueue(new TextEncoder().encode('{}')); source.close(); }
  for (const response of await Promise.all(pending)) await response.body.cancel();
});

for (const edition of ['personal', 'multi']) {
  test(`${edition}/budget: a request does not fan out through unlimited failed targets`, async () => {
    const m = await loadEdition(edition), f = fixture(m, edition);
    try {
      f.respond(() => new Response('failed', { status: 503 }));
      const targets = Array.from({ length: 10 }, (_, i) => `https://origin-${i}.test/Videos/test/stream`);
      const response = await m.proxyDirectUrl(f.request('/demo/Videos/test/stream'), f.env, f.ctx, targets, { enableCache: false });
      assert.equal(response.status, 503);
      assert.equal(f.calls.length, 3);
      await response.body.cancel();
    } finally { f.restore(); }
  });
}
