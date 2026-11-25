import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEdition, fixture } from './helpers.mjs';

for (const edition of ['personal', 'multi']) {
  const start = 'https://api.test/Videos/test/stream';
  const setup = async () => {
    const m = await loadEdition(edition), f = fixture(m, edition, { stream_target: '' });
    return { m, f, call(request, opts = {}) { return m.proxyDirectUrl(request || f.request('/demo/Videos/test/stream'), f.env, f.ctx, [start], { enableCache: false, ...opts }); } };
  };

  test(`${edition}/redirect: every hop is manual and Range/signature spelling survives`, async () => {
    const { f, call } = await setup();
    const target = 'https://media.test/path%2Ffile?sign=x%2By%2f%3D&x=1&x=2&name=a+b';
    try {
      f.respond(req => {
        assert.equal(req.redirect, 'manual');
        assert.equal(req.headers.get('Range'), 'bytes=10-19');
        assert.equal(req.headers.get('If-Range'), '"etag"');
        if (req.url === start) return new Response(null, { status: 302, headers: { Location: '/redirect' } });
        if (req.url === 'https://api.test/redirect') return new Response(null, { status: 307, headers: { Location: target } });
        assert.equal(req.url, target);
        return new Response('0123456789', { status: 206, headers: { 'Content-Range': 'bytes 10-19/100', 'Content-Length': '10' } });
      });
      const response = await call(f.request('/demo/Videos/test/stream', { headers: { Range: 'bytes=10-19', 'If-Range': '"etag"' } }));
      assert.equal(response.status, 206);
      assert.equal(response.headers.get('Content-Range'), 'bytes 10-19/100');
      assert.equal(await response.text(), '0123456789');
      assert.equal(f.calls.length, 3);
    } finally { f.restore(); }
  });

  test(`${edition}/redirect: second-hop private targets and HTTPS downgrade are blocked`, async () => {
    for (const target of ['http://127.0.0.1/secret', 'https://169.254.169.254/', 'https://[::ffff:7f00:1]/', 'https://localhost./', 'http://media.test/', 'file:///etc/passwd', 'https://name:pass@media.test/']) {
      const { f, call } = await setup();
      let cancelled = 0;
      try {
        f.respond(req => new Response(new ReadableStream({ cancel() { cancelled++; } }), {
          status: 302, headers: { Location: req.url === start ? 'https://public.test/hop' : target },
        }));
        assert.equal((await call()).status, 502, target);
        assert.equal(f.calls.length, 2, target);
        assert.equal(cancelled, 2, target);
      } finally { f.restore(); }
    }
  });

  test(`${edition}/redirect: credentials are stripped and not restored after leaving origin`, async () => {
    const { f, call } = await setup();
    try {
      f.respond(req => {
        if (req.url === start) return new Response(null, { status: 302, headers: { Location: 'https://media.test/hop' } });
        for (const name of ['Authorization', 'Cookie', 'X-Emby-Token', 'X-MediaBrowser-Authorization', 'X-Emby-Api-Key']) assert.equal(req.headers.has(name), false, name);
        if (req.url === 'https://media.test/hop') return new Response(null, { status: 302, headers: { Location: 'https://api.test/back' } });
        return new Response('safe');
      });
      const request = f.request('/demo/Videos/test/stream', { headers: { Authorization: 'test', Cookie: 'test=1', 'X-Emby-Token': 'test', 'X-MediaBrowser-Authorization': 'test', 'X-Emby-Api-Key': 'test' } });
      assert.equal(await (await call(request)).text(), 'safe');
      assert.equal(f.calls.length, 3);
    } finally { f.restore(); }
  });

  test(`${edition}/redirect: loops and too many hops stop within bounded requests`, async () => {
    for (const loop of [true, false]) {
      const { f, call } = await setup();
      try {
        f.respond(() => new Response(null, { status: 302, headers: { Location: loop ? start : `https://api.test/hop-${f.calls.length}` } }));
        assert.equal((await call()).status, 502);
        assert.equal(f.calls.length, loop ? 1 : 6);
      } finally { f.restore(); }
    }
  });

  test(`${edition}/redirect: POST 303 becomes a bodyless GET`, async () => {
    const { f, call } = await setup();
    try {
      f.respond(req => {
        if (req.url === start) return new Response(null, { status: 303, headers: { Location: '/result' } });
        assert.equal(req.method, 'GET');
        assert.equal(req.body, null);
        assert.equal(req.headers.has('Content-Type'), false);
        assert.equal(req.headers.has('Content-Length'), false);
        return new Response('result');
      });
      const response = await call(f.request('/demo/write', { method: 'POST', body: '{}', headers: { 'Content-Length': '2', 'Content-Type': 'application/json' } }));
      assert.equal(await response.text(), 'result');
      assert.equal(f.calls.length, 2);
    } finally { f.restore(); }
  });

  test(`${edition}/redirect: streaming POST 307 is not replayed`, async () => {
    const { f, call } = await setup();
    try {
      f.respond(() => new Response(null, { status: 307, headers: { Location: '/result' } }));
      assert.equal((await call(f.request('/demo/write', { method: 'POST', body: 'unknown-length' }))).status, 502);
      assert.equal(f.calls.length, 1);
    } finally { f.restore(); }
  });

  test(`${edition}/redirect: compatibility mode still validates later hops`, async () => {
    const { f, call } = await setup();
    try {
      f.respond(() => new Response(null, { status: 302, headers: { Location: 'https://127.0.0.1/private' } }));
      assert.equal((await call(null, { compatMode: true })).status, 502);
      assert.equal(f.calls.length, 1);
    } finally { f.restore(); }
  });
}
