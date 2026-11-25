import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRequestBody, MAX_REPLAY_BYTES } from '../src/shared/proxy/body-plan.js';
import { hasPrivateRequestState, canStorePublicResponse } from '../src/shared/proxy/cache-policy.js';
import { discardResponse } from '../src/shared/proxy/lifecycle.js';
import { loadEdition, fixture } from './helpers.mjs';

test('body plan: explicitly small bodies can be read again without clone/tee', async () => {
  const request = new Request('https://proxy.test/', { method: 'POST', body: 'test', headers: { 'Content-Length': '4' } });
  const plan = await prepareRequestBody(request);
  assert.equal(plan.replayable, true);
  for (let i = 0; i < 2; i++) {
    const init = { method: 'POST' }; plan.apply(init);
    assert.equal(await new Request('https://upstream.test/', init).text(), 'test');
  }
});

test('body plan: unknown length is replayable only with an explicit bounded opt-in', async () => {
  const request = new Request('https://proxy.test/', { method: 'POST', body: 'test' });
  const plan = await prepareRequestBody(request, 256, 100, { bufferUnknown: true });
  assert.equal(plan.replayable, true);
  for (let i = 0; i < 2; i++) {
    const init = { method: 'POST' }; plan.apply(init);
    assert.equal(await new Request('https://upstream.test/', init).text(), 'test');
  }
});

test('body plan: opted-in unknown length still has a body-read deadline', async () => {
  let cancelled = false;
  const request = new Request('https://proxy.test/', { method: 'POST', body: new ReadableStream({ cancel() { cancelled = true; } }), duplex: 'half' });
  await assert.rejects(prepareRequestBody(request, 256, 5, { bufferUnknown: true }), /timed out/);
  assert.equal(cancelled, true);
});

test('body plan: unknown/large bodies reach upstream before upload completes', async () => {
  for (const headers of [{}, { 'Content-Length': String(MAX_REPLAY_BYTES + 1) }]) {
    let source;
    const body = new ReadableStream({ start(c) { source = c; } }, { highWaterMark: 0 });
    const request = new Request('https://proxy.test/', { method: 'PUT', body, duplex: 'half', headers });
    const plan = await prepareRequestBody(request);
    assert.equal(plan.replayable, false);
    const init = { method: 'PUT' }; plan.apply(init);
    assert.equal(init.body, body);
    assert.throws(() => plan.apply({}), /cannot be replayed/);
    source.enqueue(new TextEncoder().encode('unfinished upload')); source.close();
    assert.equal(await new Request('https://upstream.test/', init).text(), 'unfinished upload');
  }
});

test('body plan: false small Content-Length falls back without truncating bytes', async () => {
  const bytes = new Uint8Array(MAX_REPLAY_BYTES + 20).fill(42);
  const request = new Request('https://proxy.test/', { method: 'POST', body: bytes, headers: { 'Content-Length': '1' } });
  const plan = await prepareRequestBody(request);
  assert.equal(plan.replayable, false);
  const init = { method: 'POST' }; plan.apply(init);
  assert.deepEqual(new Uint8Array(await new Request('https://upstream.test/', init).arrayBuffer()), bytes);
});

test('body plan: stalled small declared bodies are bounded by time', async () => {
  let cancelled = false;
  const request = new Request('https://proxy.test/', { method: 'POST', headers: { 'Content-Length': '4' }, body: new ReadableStream({ cancel() { cancelled = true; } }), duplex: 'half' });
  await assert.rejects(prepareRequestBody(request, 256, 5), /timed out/);
  assert.equal(cancelled, true);
});

test('body plan: cancellation during small-body reads does not produce a partial replay', async () => {
  const controller = new AbortController();
  const request = new Request('https://proxy.test/', { method: 'POST', headers: { 'Content-Length': '4' }, body: new ReadableStream(), duplex: 'half', signal: controller.signal });
  const pending = prepareRequestBody(request);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('cache policy: auth carrier spelling cannot create a shared entry', () => {
  for (const key of ['api_key', 'ApiKey', 'X-Emby-Token', 'token', 'Signature', 'sign', 'jwt', 'key']) {
    assert.equal(hasPrivateRequestState(new Request(`https://proxy.test/image.jpg?${key}=test`)), true, key);
  }
  for (const name of ['Authorization', 'Cookie', 'X-Emby-Authorization', 'X-MediaBrowser-Authorization', 'X-Emby-Api-Key']) {
    assert.equal(hasPrivateRequestState(new Request('https://proxy.test/image.jpg', { headers: { [name]: 'test' } })), true, name);
  }
  assert.equal(hasPrivateRequestState(new Request('https://proxy.test/app.js?v=1')), false);
});

test('cache policy: origin privacy and negotiation are not overwritten', () => {
  for (const headers of [
    { 'Cache-Control': 'private, max-age=60' }, { 'Cache-Control': 'no-store' },
    { 'Cache-Control': 'no-cache' }, { 'Vary': '*' }, { 'Vary': 'Accept-Encoding' }, { 'Set-Cookie': 'test=1' },
  ]) assert.equal(canStorePublicResponse(new Response('test', { headers })), false);
  assert.equal(canStorePublicResponse(new Response('public')), true);
});

test('discard: cancellation must not wait for a hung peer', () => {
  let cancelled = false;
  discardResponse(new Response(new ReadableStream({ cancel() { cancelled = true; return new Promise(() => {}); } })));
  assert.equal(cancelled, true);
});

for (const edition of ['personal', 'multi']) {
  const path = '/Videos/test/stream';
  const urls = ['https://one.test' + path, 'https://two.test' + path];
  const call = (m, f, request, targets = urls) => m.proxyDirectUrl(request, f.env, f.ctx, targets, { enableCache: false });

  test(`${edition}/safety: failover cancels discarded error body but preserves final body`, async () => {
    const m = await loadEdition(edition), f = fixture(m, edition);
    let cancelled = false;
    try {
      f.respond(req => req.url.startsWith('https://one.test')
        ? new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 503 })
        : new Response('healthy'));
      const response = await call(m, f, f.request('/demo' + path));
      assert.equal(await response.text(), 'healthy');
      assert.equal(cancelled, true);
      assert.equal(f.calls.length, 2);
    } finally { f.restore(); }
  });

  test(`${edition}/safety: all-failed targets preserve only the last error body`, async () => {
    const m = await loadEdition(edition), f = fixture(m, edition);
    let cancelled = false;
    try {
      f.respond(req => req.url.startsWith('https://one.test')
        ? new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 503 })
        : new Response('last failure', { status: 503 }));
      const response = await call(m, f, f.request('/demo' + path));
      assert.equal(response.status, 503);
      assert.equal(await response.text(), 'last failure');
      assert.equal(cancelled, true);
    } finally { f.restore(); }
  });

  test(`${edition}/safety: POST is never replayed just because its bytes fit in memory`, async () => {
    const m = await loadEdition(edition), f = fixture(m, edition);
    try {
      f.respond(() => new Response('failure', { status: 503 }));
      const request = f.request('/demo/Items/test/PlaybackInfo', { method: 'POST', body: '{}', headers: { 'Content-Length': '2' } });
      const response = await call(m, f, request);
      assert.equal(response.status, 503);
      assert.equal(f.calls.length, 1);
      assert.equal(await f.calls[0].text(), '{}');
    } finally { f.restore(); }
  });

  test(`${edition}/safety: failed write transport is not replayed to a second target`, async () => {
    const m = await loadEdition(edition), f = fixture(m, edition);
    try {
      f.respond(() => { throw new Error('Connection reset after upstream accepted write'); });
      const response = await call(m, f, f.request('/demo/upload', { method: 'PUT', body: 'test' }));
      assert.equal(response.status, 502);
      assert.equal(f.calls.length, 1);
    } finally { f.restore(); }
  });

  test(`${edition}/safety: upload dispatch does not wait for the whole request`, async () => {
    const m = await loadEdition(edition), f = fixture(m, edition);
    let source;
    const body = new ReadableStream({ start(c) { source = c; } }, { highWaterMark: 0 });
    try {
      f.respond(() => new Response('accepted'));
      const request = new Request('https://proxy.test/upload', { method: 'POST', body, duplex: 'half' });
      const response = await call(m, f, request);
      assert.equal(response.status, 200);
      source.enqueue(new TextEncoder().encode('late bytes')); source.close();
      assert.equal(await f.calls[0].text(), 'late bytes');
    } finally { f.restore(); }
  });

  test(`${edition}/safety: client cancellation aborts upstream and does not fail over`, async () => {
    const m = await loadEdition(edition), f = fixture(m, edition), controller = new AbortController();
    let started;
    const ready = new Promise(resolve => { started = resolve; });
    try {
      f.respond(req => new Promise((resolve, reject) => {
        req.signal.addEventListener('abort', () => reject(req.signal.reason), { once: true });
        started();
      }));
      const pending = call(m, f, new Request('https://proxy.test/media', { signal: controller.signal }));
      await ready;
      controller.abort();
      assert.equal((await pending).status, 499);
      assert.equal(f.calls.length, 1);
      assert.equal(f.calls[0].signal.aborted, true);
    } finally { f.restore(); }
  });

  test(`${edition}/safety: query-auth images never read or populate shared cache`, async () => {
    const m = await loadEdition(edition), f = fixture(m, edition);
    try {
      f.respond(() => new Response('private image'));
      for (const token of ['alice', 'bob']) {
        const response = await f.serve(f.request(`/demo/Items/test/Images/Primary?ApiKey=${token}`));
        assert.equal(await response.text(), 'private image');
      }
      assert.deepEqual(f.cacheReads, []);
      assert.deepEqual(f.cacheWrites, []);
    } finally { f.restore(); }
  });

  test(`${edition}/safety: public resource respects origin private/no-store/Vary`, async () => {
    const m = await loadEdition(edition), f = fixture(m, edition);
    try {
      for (const headers of [{ 'Cache-Control': 'private' }, { 'Cache-Control': 'no-store' }, { Vary: 'Accept-Encoding' }]) {
        f.respond(() => new Response('test', { headers }));
        const response = await f.serve(f.request('/demo/app.js'));
        for (const [key, value] of Object.entries(headers)) assert.equal(response.headers.get(key), value);
        await response.body.cancel();
      }
      assert.deepEqual(f.cacheWrites, []);
    } finally { f.restore(); }
  });
}
