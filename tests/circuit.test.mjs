import test from 'node:test';
import assert from 'node:assert/strict';
import { circuitKey, markCircuitDown, circuitUnavailable, MAX_CIRCUIT_ENTRIES } from '../src/shared/proxy/circuit.js';
import { loadEdition, fixture } from './helpers.mjs';

test('circuit keys separate tenant, host, route and upstream origin', () => {
  const request = new Request('https://proxy.test/demo/path');
  const origin = new URL('https://upstream.test/path');
  const keys = [
    circuitKey(request, origin, 'demo', 'alice'),
    circuitKey(request, origin, 'demo', 'bob'),
    circuitKey(request, origin, 'other', 'alice'),
    circuitKey(new Request('https://other.test/demo/path'), origin, 'demo', 'alice'),
    circuitKey(request, new URL('https://upstream.test:8443/path'), 'demo', 'alice'),
  ];
  assert.equal(new Set(keys).size, keys.length);
});

test('circuit state has a hard cap even when all failures are fresh', () => {
  const state = new Map();
  for (let i = 0; i < MAX_CIRCUIT_ENTRIES * 2; i++) markCircuitDown(state, String(i), 100, 0);
  assert.equal(state.size, MAX_CIRCUIT_ENTRIES);
  assert.equal(state.has('0'), false);
  markCircuitDown(state, 'new', 200, 101);
  assert.deepEqual([...state.keys()], ['new']);
});

test('expired circuits allow one recovery probe rather than a thundering herd', () => {
  const state = new Map([['target', 100]]);
  assert.equal(circuitUnavailable(state, 'target', 50), true);
  assert.equal(circuitUnavailable(state, 'target', 101), false);
  assert.equal(circuitUnavailable(state, 'target', 101), true);
  state.delete('target');
  assert.equal(circuitUnavailable(state, 'target', 102), false);
});

for (const edition of ['personal', 'multi']) {
  test(`${edition}/circuit: an unhealthy route does not suppress the same host on another route`, async () => {
    const m = await loadEdition(edition), f = fixture(m, edition);
    const upstreams = ['https://first.test/Videos/test/stream', 'https://second.test/Videos/test/stream'];
    const proxy = route => m.proxyDirectUrl(f.request('/demo/Videos/test/stream'), f.env, f.ctx, upstreams, { enableCache: false, matchedPrefix: route });
    try {
      f.respond(req => new Response('test', { status: req.url.startsWith('https://first.test') ? 503 : 200 }));
      await (await proxy('route-a')).body.cancel();
      assert.equal(f.calls.length, 2);
      f.calls.length = 0;
      await (await proxy('route-a')).body.cancel();
      assert.equal(f.calls.length, 1);
      assert.ok(f.calls[0].url.startsWith('https://second.test'));
      f.calls.length = 0;
      await (await proxy('route-b')).body.cancel();
      assert.equal(f.calls.length, 2);
      assert.ok(f.calls[0].url.startsWith('https://first.test'));
    } finally { f.restore(); }
  });
}
