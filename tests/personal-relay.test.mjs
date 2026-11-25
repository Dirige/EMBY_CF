import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, loadEdition } from './helpers.mjs';

const relay = { enabled: true, relayUrl: 'https://relay.test', secret: 'fixture-secret' };
const target = 'https://api.test/Videos/test/stream?sign=a%2Bb&k=1&k=2';

for (const mode of ['auto', 'off', 'image']) {
  test(`personal relay ${mode}: Worker first and at most one relay on failure`, async () => {
    const module = await loadEdition('personal');
    const f = fixture(module, 'personal');
    try {
      f.respond(req => {
        if (new URL(req.url).host !== 'relay.test') return new Response('source failed', { status: 503 });
        assert.equal(req.headers.get('X-Relay-Target'), target);
        assert.equal(req.headers.get('Range'), 'bytes=0-3');
        return new Response('test', { status: 206 });
      });
      const res = await module.proxyDirectUrl(f.request('/demo/Videos/test/stream', { headers: { Range: 'bytes=0-3' } }), f.env, f.ctx, [target], { relayMode: mode, relay });
      assert.equal(f.calls[0].url, target);
      assert.equal(f.calls.length, mode === 'off' ? 1 : 2);
      assert.equal(res.status, mode === 'off' ? 503 : 206);
      assert.equal(res.headers.has('X-Relay-Fallback'), mode !== 'off');
    } finally { f.restore(); }
  });
}

test('personal relay on: first request and subsequent redirect both go through VPS', async () => {
  const module = await loadEdition('personal');
  const f = fixture(module, 'personal');
  const redirected = 'https://download.123pan.com/file?sign=b%2Ba';
  try {
    f.respond(req => {
      assert.equal(new URL(req.url).host, 'relay.test');
      assert.equal(req.headers.get('Range'), 'bytes=0-3');
      if (f.calls.length === 1) {
        assert.equal(req.headers.get('X-Relay-Target'), target);
        return new Response(null, { status: 302, headers: { Location: redirected } });
      }
      assert.equal(req.headers.get('X-Relay-Target'), redirected);
      return new Response('test', { status: 206 });
    });
    const res = await module.proxyDirectUrl(f.request('/demo/Videos/test/stream', { headers: { Range: 'bytes=0-3' } }), f.env, f.ctx, [target], { relayMode: 'on', relay });
    assert.equal(res.status, 206);
    assert.equal(f.calls.length, 2);
    assert.equal(res.headers.has('X-Relay-Fallback'), false);
  } finally { f.restore(); }
});

test('personal relay on: disabled VPS does not silently fall back to direct', async () => {
  const module = await loadEdition('personal');
  const f = fixture(module, 'personal');
  try {
    f.respond(() => new Response('unexpected source response'));
    const res = await module.proxyDirectUrl(f.request('/demo/Videos/test/stream'), f.env, f.ctx, [target], { relayMode: 'on', relay: { ...relay, enabled: false } });
    assert.equal(res.status, 503);
    assert.equal(f.calls.length, 0);
  } finally { f.restore(); }
});

test('personal relay on: write body reaches VPS once, never sent directly', async () => {
  const module = await loadEdition('personal');
  const f = fixture(module, 'personal');
  try {
    f.respond(async req => {
      assert.equal(new URL(req.url).host, 'relay.test');
      assert.equal(req.method, 'POST');
      assert.equal(await req.text(), 'fixture');
      return new Response(null, { status: 204 });
    });
    const res = await module.proxyDirectUrl(f.request('/demo/Items/test', { method: 'POST', body: 'fixture' }), f.env, f.ctx, [target], { relayMode: 'on', relay });
    assert.equal(res.status, 204);
    assert.equal(f.calls.length, 1);
  } finally { f.restore(); }
});

for (const [name, status, method, enabled] of [['success', 200, 'GET', true], ['write', 503, 'POST', true], ['disabled globally', 503, 'GET', false]]) {
  test(`personal relay: ${name} never contacts VPS`, async () => {
    const module = await loadEdition('personal');
    const f = fixture(module, 'personal');
    try {
      f.respond(() => new Response('source response', { status }));
      const res = await module.proxyDirectUrl(f.request('/demo/Videos/test/stream', { method }), f.env, f.ctx, [target], { relayMode: 'auto', relay: { ...relay, enabled } });
      assert.equal(res.status, status);
      assert.deepEqual(f.calls.map(req => req.url), [target]);
    } finally { f.restore(); }
  });
}

test('personal relay: a failed VPS attempt is not repeated for the next origin', async () => {
  const module = await loadEdition('personal');
  const f = fixture(module, 'personal');
  try {
    f.respond(req => { if (new URL(req.url).host === 'relay.test') return new Response(null, { status: 502 }); throw new Error('synthetic connection failure'); });
    const res = await module.proxyDirectUrl(f.request('/demo/Videos/test/stream'), f.env, f.ctx, [target, 'https://backup.test/Videos/test/stream'], { relayMode: 'auto', relay });
    assert.equal(res.status, 502);
    assert.deepEqual(f.calls.map(req => new URL(req.url).host), ['api.test', 'relay.test', 'backup.test']);
  } finally { f.restore(); }
});
