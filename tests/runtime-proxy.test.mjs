// Exercise the real workerd runtime, not just Node fetch stubs. All origins
// remain synthetic and outboundService prevents any production/network access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel } from 'miniflare';
import { root, textAssets } from '../scripts/build.mjs';

for (const edition of ['personal', 'multi']) {
  test(`${edition}/workerd: Range, signed redirects, uploads and native streaming`, { timeout: 30_000 }, async t => {
    const compiled = await build({ entryPoints: [`${root}/src/local/${edition}.js`], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false, plugins: [textAssets] });
    const calls = [];
    let source;
    const firstChunk = new Uint8Array(128 * 1024).fill(42);
    const signature = 'opaque%2Ffile?sign=a%2Bb%2f%3D&x=1&x=2&name=a+b';
    const mf = new Miniflare({
      host: '127.0.0.1', port: 0, modules: true, script: compiled.outputFiles[0].text,
      compatibilityDate: '2025-05-15', compatibilityFlags: ['nodejs_compat'],
      bindings: { LOCAL_PREVIEW: '1', ADMIN_TOKEN: 'runtime-test-only', BASE_DOMAIN: 'localhost', USER_DOMAIN: 'localhost', DISABLE_DIRECT_PROXY: '1' },
      d1Databases: { DB: `runtime-${edition}` }, log: new Log(LogLevel.ERROR),
      outboundService: async request => {
        calls.push({ url: request.url, method: request.method, range: request.headers.get('Range'), authorization: request.headers.get('Authorization'), redirect: request.redirect });
        const url = new URL(request.url);
        if (url.pathname.endsWith('/redirect')) return new Response(null, { status: 302, headers: { Location: 'https://alternate.test/' + signature } });
        if (url.hostname === 'alternate.test') return new Response('signed result');
        if (url.pathname.endsWith('/upload')) return new Response(await request.text());
        if (url.pathname.endsWith('/slow')) return new Response(new ReadableStream({ start(c) { source = c; c.enqueue(firstChunk); } }), { headers: { 'Content-Type': 'video/mp4' } });
        return new Response(request.method === 'HEAD' ? null : '2345', { status: 206, headers: { 'Content-Range': 'bytes 2-5/10', 'Content-Length': '4', 'Accept-Ranges': 'bytes' } });
      },
    });
    let disposal;
    const dispose = () => disposal ||= mf.dispose();
    t.signal.addEventListener('abort', () => { void dispose().catch(() => {}); }, { once: true });
    try {
      const origin = `http://127.0.0.1:${edition === 'personal' ? 4273 : 4274}`;
      for (const method of ['GET', 'HEAD']) {
        const response = await mf.dispatchFetch(origin + '/demo/Videos/test/stream', { method, headers: { Range: 'bytes=2-5', 'If-Range': '"etag"' } });
        assert.equal(response.status, 206);
        assert.equal(response.headers.get('Content-Range'), 'bytes 2-5/10');
        assert.equal(response.headers.get('Content-Length'), '4');
        assert.equal(await response.text(), method === 'HEAD' ? '' : '2345');
      }
      const redirected = await mf.dispatchFetch(origin + '/demo/Videos/test/redirect', { headers: { Authorization: 'test-only' } });
      assert.equal(await redirected.text(), 'signed result');
      const last = calls.at(-1);
      assert.equal(last.url, 'https://alternate.test/' + signature);
      assert.equal(last.authorization, null);

      const uploaded = await mf.dispatchFetch(origin + '/demo/upload', { method: 'POST', body: 'synthetic upload' });
      assert.equal(await uploaded.text(), 'synthetic upload');

      const streamed = await mf.dispatchFetch(origin + '/demo/Videos/test/slow');
      assert.equal(streamed.status, 200);
      // Returning the response must not depend on the origin finishing its body.
      assert.ok(source);
      const reader = streamed.body.getReader();
      const chunk = await reader.read();
      assert.ok(chunk.value.byteLength > 0);
      assert.ok(chunk.value.every(value => value === 42));
      source.close();
      let total = chunk.value.byteLength;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        total += next.value.byteLength;
      }
      assert.equal(total, firstChunk.byteLength);
      assert.equal(calls.length, 6);
    } finally { await dispose(); }
  });
}
