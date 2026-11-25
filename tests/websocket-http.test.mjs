import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel, Response as RuntimeResponse, WebSocketPair } from 'miniflare';
import { root, textAssets } from '../scripts/build.mjs';
import { loadEdition, fixture } from './helpers.mjs';

function bounded(promise, ms = 3000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out waiting for stream closure')), ms); })]).finally(() => clearTimeout(timer));
}

async function runtime(edition, outboundService) {
  const compiled = await build({ entryPoints: [`${root}/src/local/${edition}.js`], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false, plugins: [textAssets] });
  return new Miniflare({ host: '127.0.0.1', port: 0, modules: true, script: compiled.outputFiles[0].text,
    compatibilityDate: '2025-05-15', compatibilityFlags: ['nodejs_compat'],
    bindings: { LOCAL_PREVIEW: '1', ADMIN_TOKEN: 'test-only', BASE_DOMAIN: 'localhost', USER_DOMAIN: 'localhost', DISABLE_DIRECT_PROXY: '1' },
    d1Databases: { DB: 'http-test-' + edition }, log: new Log(LogLevel.ERROR), outboundService });
}

for (const edition of ['personal', 'multi']) {
  test(`${edition}/headers: admin cookies and named hop headers never reach a media origin`, async () => {
    const m = await loadEdition(edition);
    const headers = m.buildUpstreamHeaders(new Request('https://proxy.test/', { headers: {
      Cookie: 'admin_session=ADMIN; media_auth=PLAYER; emby_preview_personal=LOCAL', Connection: 'x-hop-secret', 'X-Hop-Secret': 'remove',
    } }), new URL('https://origin.test/'), { ipMode: 'forward', compatMode: false });
    assert.equal(headers.get('Cookie'), 'media_auth=PLAYER');
    assert.equal(headers.has('X-Hop-Secret'), false);
  });

  test(`${edition}/websocket: IP/header policy applies to upgrades as well`, async () => {
    for (const mode of ['forward', 'strip', 'disable']) {
      const m = await loadEdition(edition), f = fixture(m, edition);
      try {
        f.respond(req => {
          assert.equal(req.headers.get('Upgrade'), 'websocket');
          assert.equal(req.headers.has('Cookie'), false);
          assert.equal(req.headers.has('X-Forwarded-For'), mode === 'forward');
          assert.equal(req.headers.get('X-Custom'), 'configured');
          return new Response('upgrade-stub');
        });
        const response = await m.proxyDirectUrl(f.request('/demo/socket', { headers: { Upgrade: 'websocket', Cookie: 'admin_session=ADMIN' } }), f.env, f.ctx, ['https://origin.test/socket'], { clientIpMode: mode, customHeaders: [['X-Custom', 'configured']] });
        assert.equal(await response.text(), 'upgrade-stub');
      } finally { f.restore(); }
    }
  });

  test(`${edition}/workerd: real WebSocket upgrade echoes and closes`, { timeout: 15000 }, async () => {
    const mf = await runtime(edition, async request => {
      assert.equal(request.headers.get('Upgrade'), 'websocket');
      assert.equal(request.headers.has('Cookie'), false);
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();
      server.addEventListener('message', event => server.send(event.data));
      server.addEventListener('close', () => server.close());
      return new RuntimeResponse(null, { status: 101, webSocket: client });
    });
    try {
      const response = await mf.dispatchFetch('http://127.0.0.1/demo/socket', { headers: { Upgrade: 'websocket', Cookie: 'admin_session=ADMIN' } });
      assert.equal(response.status, 101);
      const socket = response.webSocket;
      socket.accept();
      const received = new Promise(resolve => socket.addEventListener('message', event => resolve(event.data), { once: true }));
      socket.send('synthetic message');
      assert.equal(await bounded(received), 'synthetic message');
      socket.close();
    } finally { await mf.dispose(); }
  });

  test(`${edition}/http: client cancellation closes the real upstream socket`, { timeout: 15000 }, async () => {
    let closed;
    const upstreamClosed = new Promise(resolve => { closed = resolve; });
    let written = 0;
    const block = Buffer.alloc(64 * 1024, 42);
    const mf = await runtime(edition, { async node(req, res) {
      let timer;
      res.once('close', () => { clearTimeout(timer); closed(); });
      res.writeHead(200, { 'Content-Type': 'video/mp4' });
      const send = () => {
        if (res.destroyed) return;
        written += block.length;
        if (written >= 32 * 1024 * 1024) { res.end(); return; }
        res.write(block);
        timer = setTimeout(send, 5);
      };
      send();
    } });
    try {
      const endpoint = await mf.ready;
      const response = await fetch(new URL('/demo/Videos/test/stream', endpoint));
      const reader = response.body.getReader();
      assert.ok((await reader.read()).value.byteLength);
      await reader.cancel();
      await bounded(upstreamClosed);
      assert.ok(written < 32 * 1024 * 1024, 'Origin must stop before completing the synthetic stream');
    } finally { await mf.dispose(); }
  });
}

test('multi/websocket: mapped cross-origin media upgrades strip player credentials too', async () => {
  const m = await loadEdition('multi'), f = fixture(m, 'multi');
  try {
    f.respond(request => {
      for (const name of ['Cookie', 'Authorization', 'X-Emby-Token']) assert.equal(request.headers.has(name), false, name);
      return new Response('upgrade-stub');
    });
    const response = await m.proxyDirectUrl(f.request('/demo/__stream/0/socket', { headers: { Upgrade: 'websocket', Cookie: 'media_auth=PLAYER', Authorization: 'test', 'X-Emby-Token': 'test' } }), f.env, f.ctx, ['https://media.test/socket'], { isStreamRequest: true, streamReferrer: 'https://api.test/web/index.html' });
    assert.equal(await response.text(), 'upgrade-stub');
  } finally { f.restore(); }
});
