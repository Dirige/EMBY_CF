// Run the production personal entry in workerd. Every origin and credential is
// synthetic; outboundService prevents any external/production network access.
import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel } from 'miniflare';
import { root, textAssets } from '../scripts/build.mjs';

test('personal/workerd: POST 403 replay, VPS preference, native Range and write exclusions', { timeout: 30_000 }, async t => {
  const compiled = await build({ entryPoints: [`${root}/src/personal.js`], bundle: true, format: 'esm',
    platform: 'browser', target: 'es2022', write: false, plugins: [textAssets] });
  const calls = [];
  const mf = new Miniflare({
    host: '127.0.0.1', port: 0, modules: true, script: compiled.outputFiles[0].text,
    compatibilityDate: '2025-05-15', compatibilityFlags: ['nodejs_compat'],
    bindings: { ADMIN_TOKEN: 'synthetic-runtime-password', BASE_DOMAIN: 'proxy.test', DISABLE_DIRECT_PROXY: '1' },
    d1Databases: { DB: 'runtime-auto-relay' }, log: new Log(LogLevel.ERROR),
    outboundService: async request => {
      const relayed = new URL(request.url).hostname === 'relay.test';
      const destination = relayed ? request.headers.get('X-Relay-Target') : request.url;
      const body = request.method === 'POST' ? await request.text() : null;
      calls.push({ relayed, method: request.method, destination, body, range: request.headers.get('Range') });
      if (!relayed) return new Response('synthetic IP block', { status: 403 });
      assert.match(request.headers.get('X-Relay-Auth'), /^[0-9a-f]{64}$/);
      if (request.method === 'POST') return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } });
      return new Response('test', { status: 206, headers: { 'Content-Range': 'bytes 10-13/100', 'Content-Length': '4' } });
    },
  });
  let disposal;
  const dispose = () => disposal ||= mf.dispose();
  t.signal.addEventListener('abort', () => { void dispose().catch(() => {}); }, { once: true });
  try {
    const origin = 'https://proxy.test';
    assert.equal((await mf.dispatchFetch(origin + '/health')).status, 200);
    const db = await mf.getD1Database('DB');
    await db.prepare("INSERT INTO routes (prefix,target,enabled,use_relay) VALUES ('demo','https://api.test',1,'auto'),('write','https://api.test',1,'auto')").run();
    await db.prepare("INSERT INTO relay_config (id,relay_url,secret,enabled) VALUES (1,'https://relay.test','synthetic-relay-secret','on')").run();

    const loginBody = '{"Username":"fixture","Pw":"synthetic-password"}';
    const login = await mf.dispatchFetch(origin + '/demo/Users/AuthenticateByName', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: loginBody,
    });
    assert.equal(login.status, 200);
    assert.equal(login.headers.get('X-Relay-Fallback'), '1');
    assert.deepEqual(calls.map(row => row.body), [loginBody, loginBody]);
    assert.deepEqual(calls.map(row => row.relayed), [false, true]);

    const playback = await mf.dispatchFetch(origin + '/demo/Items/test/PlaybackInfo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(playback.status, 200);
    assert.equal(calls.at(-1).relayed, true);
    assert.equal(calls.at(-1).body, '{}');
    assert.equal(calls.length, 3);

    const signed = '/demo/Videos/test/stream?sign=a%2Bb%2f%3D&k=1&k=2';
    const media = await mf.dispatchFetch(origin + signed, { headers: { Range: 'bytes=10-13' } });
    assert.equal(media.status, 206);
    assert.equal(media.headers.get('Content-Range'), 'bytes 10-13/100');
    assert.equal(await media.text(), 'test');
    assert.equal(calls.at(-1).range, 'bytes=10-13');
    assert.equal(calls.at(-1).destination, 'https://api.test/Videos/test/stream?sign=a%2Bb%2f%3D&k=1&k=2');
    assert.equal(calls.length, 4);

    const write = await mf.dispatchFetch(origin + '/write/Sessions/Playing/Progress', {
      method: 'POST', body: '{"synthetic":true}', headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(write.status, 403);
    assert.equal(calls.at(-1).relayed, false);
    assert.equal(calls.length, 5);
  } finally { await dispose(); }
});
