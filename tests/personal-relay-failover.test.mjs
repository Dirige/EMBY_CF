import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, loadEdition } from './helpers.mjs';
import { MAX_REPLAY_BYTES } from '../src/shared/proxy/body-plan.js';
import { RELAY_PREFERENCE_MS } from '../src/editions/personal/relay/preference.js';

const relay = { enabled: true, relayUrl: 'https://relay.test', secret: 'synthetic-relay-secret' };
const target = 'https://api.test/Videos/test/stream?sign=a%2Bb%2f%3D&k=1&k=2';
const opts = { relayMode: 'auto', relay, enableCache: false };
const isRelay = request => new URL(request.url).hostname === 'relay.test';
const setup = async () => {
  const m = await loadEdition('personal'), f = fixture(m, 'personal');
  return { f, call(request = f.request('/demo/Videos/test/stream'), urls = [target], overrides = {}) {
    return m.proxyDirectUrl(request, f.env, f.ctx, urls, { ...opts, ...overrides });
  } };
};
const jsonPost = (f, path, body = '{"Username":"fixture","Pw":"synthetic-password"}') => f.request('/demo' + path, {
  method: 'POST', body, headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) },
});

for (const mode of ['auto', 'image']) for (const method of ['GET', 'HEAD']) for (const status of [401, 403, 451]) {
  test(`personal ${mode}: ${method} ${status} switches once to VPS with Range and signed URL intact`, async () => {
    const { f, call } = await setup();
    let cancelled = false;
    try {
      f.respond(req => {
        if (!isRelay(req)) return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status });
        assert.equal(req.method, method);
        assert.equal(req.headers.get('X-Relay-Target'), target);
        assert.equal(req.headers.get('Range'), 'bytes=10-13');
        assert.equal(req.headers.get('If-Range'), '"fixture-etag"');
        assert.ok(req.headers.get('X-Relay-Auth'));
        return new Response(method === 'HEAD' ? null : 'test', { status: 206, headers: { 'Content-Range': 'bytes 10-13/100' } });
      });
      const response = await call(f.request('/demo/Videos/test/stream', { method, headers: { Range: 'bytes=10-13', 'If-Range': '"fixture-etag"' } }), [target], { relayMode: mode });
      assert.equal(response.status, 206);
      assert.equal(response.headers.get('X-Relay-Fallback'), '1');
      assert.equal(response.headers.get('Content-Range'), 'bytes 10-13/100');
      assert.equal(await response.text(), method === 'HEAD' ? '' : 'test');
      assert.equal(f.calls.length, 2);
      assert.equal(cancelled, true);
    } finally { f.restore(); }
  });
}

for (const path of ['/emby/Users/AuthenticateByName', '/Users/AuthenticateWithQuickConnect', '/Items/test/PlaybackInfo']) {
  for (const status of [401, 403, 451]) {
    test(`personal auto: small POST ${path} explicitly denied with ${status} replays exact bytes once`, async () => {
      const { f, call } = await setup();
      const body = '{"Username":"fixture","Pw":"synthetic-password","Data":"a+%2Fb"}';
      try {
        f.respond(async req => {
          assert.equal(req.method, 'POST');
          assert.equal(req.headers.get('Content-Type'), 'application/json');
          assert.equal(req.headers.get('Content-Length'), String(Buffer.byteLength(body)));
          assert.equal(await req.text(), body);
          return new Response(isRelay(req) ? 'accepted' : 'blocked', { status: isRelay(req) ? 200 : status });
        });
        const response = await call(jsonPost(f, path, body), ['https://api.test' + path]);
        assert.equal(await response.text(), 'accepted');
        assert.equal(response.headers.get('X-Relay-Fallback'), '1');
        assert.deepEqual(f.calls.map(req => new URL(req.url).hostname), ['api.test', 'relay.test']);
        await Promise.all(f.pending);
        assert.equal(JSON.stringify(f.audit).includes('synthetic-password'), false);
        assert.equal(JSON.stringify(f.audit).includes('https://'), false);
      } finally { f.restore(); }
    });
  }
}

for (const path of ['/Sessions/Playing/Progress', '/Sessions/Playing', '/Items/test/Update', '/Items/test/PlaybackInfo/Update']) {
  test(`personal auto: unrelated POST ${path} is not replayed after 403`, async () => {
    const { f, call } = await setup();
    try {
      f.respond(() => new Response('rejected', { status: 403 }));
      const response = await call(jsonPost(f, path, '{}'), ['https://api.test' + path]);
      assert.equal(response.status, 403);
      assert.equal(f.calls.length, 1);
    } finally { f.restore(); }
  });
}

for (const reason of [500, 503, 504, 'transport']) {
  test(`personal auto: even whitelisted POST is never replayed after ambiguous ${reason}`, async () => {
    const { f, call } = await setup();
    try {
      f.respond(() => {
        if (reason === 'transport') throw new Error('Synthetic reset after a write may have executed');
        return new Response('failed', { status: reason });
      });
      const response = await call(jsonPost(f, '/Items/test/PlaybackInfo', '{}'), ['https://api.test/Items/test/PlaybackInfo']);
      assert.equal(response.status, reason === 'transport' ? 502 : reason);
      assert.equal(f.calls.length, 1);
    } finally { f.restore(); }
  });
}

for (const kind of ['large', 'false-length']) {
  test(`personal auto: ${kind} POST body is not buffered/replayed without a verified bound`, async () => {
    const { f, call } = await setup();
    const body = new Uint8Array(MAX_REPLAY_BYTES + 5).fill(42);
    const headers = { 'Content-Length': kind === 'large' ? String(body.byteLength) : '1' };
    try {
      f.respond(async req => {
        const bytes = new Uint8Array(await req.arrayBuffer());
        assert.deepEqual(bytes, body);
        return new Response('blocked', { status: 403 });
      });
      const response = await call(f.request('/demo/Users/AuthenticateByName', { method: 'POST', body, headers }), ['https://api.test/Users/AuthenticateByName']);
      assert.equal(response.status, 403);
      assert.equal(f.calls.length, 1);
    } finally { f.restore(); }
  });
}

test('personal auto: unknown-length small login is bounded before replaying an explicit 403', async () => {
  const { f, call } = await setup();
  const body = '{"Username":"fixture","Pw":"synthetic-password"}';
  try {
    f.respond(async req => {
      assert.equal(await req.text(), body);
      return new Response(isRelay(req) ? 'ok' : 'blocked', { status: isRelay(req) ? 200 : 403 });
    });
    const response = await call(f.request('/demo/Users/AuthenticateByName', { method: 'POST', body }), ['https://api.test/Users/AuthenticateByName']);
    assert.equal(await response.text(), 'ok');
    assert.equal(f.calls.length, 2);
  } finally { f.restore(); }
});

test('personal auto: unknown-length large login overflows to a complete one-shot stream, never a retry', async () => {
  const { f, call } = await setup();
  const body = new Uint8Array(MAX_REPLAY_BYTES + 5).fill(42);
  try {
    f.respond(async req => {
      assert.deepEqual(new Uint8Array(await req.arrayBuffer()), body);
      return new Response('blocked', { status: 403 });
    });
    const response = await call(f.request('/demo/Users/AuthenticateByName', { method: 'POST', body }), ['https://api.test/Users/AuthenticateByName']);
    assert.equal(response.status, 403);
    assert.equal(f.calls.length, 1);
  } finally { f.restore(); }
});

test('personal auto: general unknown-length upload dispatches without waiting for its body', async () => {
  const { f, call } = await setup();
  let source;
  const body = new ReadableStream({ start(c) { source = c; } }, { highWaterMark: 0 });
  try {
    f.respond(() => new Response('blocked', { status: 403 }));
    const response = await call(f.request('/demo/upload', { method: 'POST', body, duplex: 'half' }), ['https://api.test/upload']);
    assert.equal(response.status, 403);
    assert.equal(f.calls.length, 1);
    source.enqueue(new TextEncoder().encode('late upload')); source.close();
    assert.equal(await f.calls[0].text(), 'late upload');
  } finally { f.restore(); }
});

test('personal auto: VPS auth failure preserves the direct auth error and does not create a preference', async () => {
  const { f, call } = await setup();
  let discarded = 0;
  try {
    f.respond(req => isRelay(req)
      ? new Response(new ReadableStream({ cancel() { discarded++; } }), { status: 401 })
      : new Response('original permission error', { status: 403 }));
    for (let i = 0; i < 2; i++) {
      const response = await call();
      assert.equal(response.status, 403);
      assert.equal(await response.text(), 'original permission error');
      assert.equal(response.headers.has('X-Relay-Fallback'), false);
    }
    assert.deepEqual(f.calls.map(req => new URL(req.url).hostname), ['api.test', 'relay.test', 'api.test', 'relay.test']);
    assert.equal(discarded, 2);
  } finally { f.restore(); }
});

test('personal auto: successful fallback prioritizes VPS for the next login without replaying a streaming POST', async () => {
  const { f, call } = await setup();
  try {
    f.respond(async req => {
      if (!isRelay(req)) return new Response('blocked', { status: 403 });
      if (req.method === 'POST') assert.equal(await req.text(), 'unknown-length-login');
      return new Response('accepted');
    });
    await (await call()).body.cancel();
    const response = await call(f.request('/demo/Users/AuthenticateByName', { method: 'POST', body: 'unknown-length-login' }), ['https://api.test/Users/AuthenticateByName']);
    assert.equal(await response.text(), 'accepted');
    assert.deepEqual(f.calls.map(req => new URL(req.url).hostname), ['api.test', 'relay.test', 'relay.test']);
  } finally { f.restore(); }
});

test('personal auto: cooldown does not slide, and a recovered read restores direct routing', async t => {
  const { f, call } = await setup();
  let now = 1_700_000_000_000, blocked = true;
  t.mock.method(Date, 'now', () => now);
  try {
    f.respond(req => new Response(isRelay(req) || !blocked ? 'ok' : 'blocked', { status: isRelay(req) || !blocked ? 200 : 403 }));
    await (await call()).body.cancel();
    now += RELAY_PREFERENCE_MS - 1;
    await (await call()).body.cancel();
    now += 2;
    blocked = false;
    await (await call()).body.cancel();
    await (await call(jsonPost(f, '/Sessions/Playing/Stopped', '{}'), ['https://api.test/Sessions/Playing/Stopped'])).body.cancel();
    assert.deepEqual(f.calls.map(req => new URL(req.url).hostname), ['api.test', 'relay.test', 'relay.test', 'api.test', 'api.test']);
  } finally { f.restore(); }
});

test('personal auto: only one concurrent read probes a recovered route; other reads and writes stay on VPS', async t => {
  const { f, call } = await setup();
  let now = 1_700_000_000_000;
  t.mock.method(Date, 'now', () => now);
  let release, started;
  const ready = new Promise(resolve => { started = resolve; });
  try {
    f.respond(req => new Response(isRelay(req) ? 'ok' : 'blocked', { status: isRelay(req) ? 200 : 403 }));
    await (await call()).body.cancel();
    now += RELAY_PREFERENCE_MS + 1;
    f.respond(req => isRelay(req) ? new Response('preferred') : new Promise(resolve => { release = resolve; started(); }));
    const probing = call();
    await ready;
    assert.equal(await (await call()).text(), 'preferred');
    assert.equal(await (await call(jsonPost(f, '/Items/test/PlaybackInfo', '{}'), ['https://api.test/Items/test/PlaybackInfo'])).text(), 'preferred');
    release(new Response('recovered'));
    assert.equal(await (await probing).text(), 'recovered');
    f.respond(() => new Response('direct'));
    assert.equal(await (await call()).text(), 'direct');
    assert.deepEqual(f.calls.map(req => new URL(req.url).hostname), ['api.test', 'relay.test', 'api.test', 'relay.test', 'relay.test', 'api.test']);
  } finally { if (release) release(new Response('cleanup')); f.restore(); }
});

test('personal auto: a 404 recovery read does not mistake a missing endpoint for successful restoration', async t => {
  const { f, call } = await setup();
  let now = 1_700_000_000_000;
  t.mock.method(Date, 'now', () => now);
  try {
    f.respond(req => new Response(isRelay(req) ? 'ok' : 'blocked', { status: isRelay(req) ? 200 : 403 }));
    await (await call()).body.cancel();
    now += RELAY_PREFERENCE_MS + 1;
    f.respond(req => new Response(isRelay(req) ? 'preferred' : 'not found', { status: isRelay(req) ? 200 : 404 }));
    assert.equal((await call()).status, 404);
    assert.equal(await (await call(jsonPost(f, '/Items/test/PlaybackInfo', '{}'), ['https://api.test/Items/test/PlaybackInfo'])).text(), 'preferred');
    assert.deepEqual(f.calls.map(req => new URL(req.url).hostname), ['api.test', 'relay.test', 'api.test', 'relay.test']);
  } finally { f.restore(); }
});

test('personal auto: preference is isolated to the route, source origin, CF colo and country', async () => {
  const { f, call } = await setup();
  const req = (prefix, colo, country) => {
    const request = f.request(`/${prefix}/Videos/test/stream`);
    Object.defineProperty(request, 'cf', { value: { colo, country } });
    return request;
  };
  try {
    f.respond(r => new Response(isRelay(r) ? 'ok' : 'blocked', { status: isRelay(r) ? 200 : 403 }));
    await (await call(req('demo', 'NRT', 'CN'))).body.cancel();
    f.respond(() => new Response('direct'));
    for (const request of [req('other', 'NRT', 'CN'), req('demo', 'SIN', 'CN'), req('demo', 'NRT', 'SG')]) {
      assert.equal(await (await call(request)).text(), 'direct');
      assert.equal(isRelay(f.calls.at(-1)), false);
    }
    assert.equal(await (await call(req('demo', 'NRT', 'CN'), ['https://backup.test/Videos/test/stream'])).text(), 'direct');
    assert.equal(isRelay(f.calls.at(-1)), false);
    await (await call(req('demo', 'NRT', 'CN'))).body.cancel();
    assert.equal(isRelay(f.calls.at(-1)), true);
  } finally { f.restore(); }
});

test('personal auto: off/global-disable bypass an existing preference; forced on retains its original behavior', async () => {
  const { f, call } = await setup();
  try {
    f.respond(r => new Response(isRelay(r) ? 'ok' : 'blocked', { status: isRelay(r) ? 200 : 403 }));
    await (await call()).body.cancel();
    const off = await call(undefined, [target], { relayMode: 'off' });
    assert.equal(off.status, 403);
    assert.equal(isRelay(f.calls.at(-1)), false);
    const disabled = await call(undefined, [target], { relay: { ...relay, enabled: false } });
    assert.equal(disabled.status, 403);
    assert.equal(isRelay(f.calls.at(-1)), false);
    const forced = await call(undefined, [target], { relayMode: 'on' });
    assert.equal(forced.status, 200);
    assert.equal(isRelay(f.calls.at(-1)), true);
    assert.equal(forced.headers.has('X-Relay-Fallback'), false);
  } finally { f.restore(); }
});

test('personal auto: unavailable preferred VPS gets one direct read, not another relay attempt', async () => {
  const { f, call } = await setup();
  try {
    f.respond(r => new Response(isRelay(r) ? 'ok' : 'blocked', { status: isRelay(r) ? 200 : 403 }));
    await (await call()).body.cancel();
    f.respond(r => new Response(isRelay(r) ? 'quota' : 'direct', { status: isRelay(r) ? 503 : 200, headers: isRelay(r) ? { 'X-Relay-Denied': 'quota' } : {} }));
    const response = await call();
    assert.equal(await response.text(), 'direct');
    assert.equal(response.headers.has('X-Relay-Fallback'), false);
    assert.deepEqual(f.calls.map(req => new URL(req.url).hostname), ['api.test', 'relay.test', 'relay.test', 'api.test']);
  } finally { f.restore(); }
});

for (const failure of ['transport', 'quota']) {
  test(`personal auto: preferred POST ${failure} is not sent a second time directly`, async () => {
    const { f, call } = await setup();
    try {
      f.respond(r => new Response(isRelay(r) ? 'ok' : 'blocked', { status: isRelay(r) ? 200 : 403 }));
      await (await call()).body.cancel();
      f.respond(r => {
        assert.equal(isRelay(r), true);
        if (failure === 'transport') throw new Error('Synthetic uncertain VPS write result');
        return new Response('quota', { status: 503, headers: { 'X-Relay-Denied': 'quota' } });
      });
      const response = await call(jsonPost(f, '/Items/test/PlaybackInfo', '{}'), ['https://api.test/Items/test/PlaybackInfo']);
      assert.equal(response.status, failure === 'transport' ? 502 : 503);
      assert.equal(f.calls.length, 3);
    } finally { f.restore(); }
  });
}

test('personal auto: a blocked second redirect hop retries via VPS without restoring cross-origin credentials', async () => {
  const { f, call } = await setup();
  const media = 'https://media.test/path%2Ffile?sign=a%2Bb%2f%3D&k=1&k=2';
  try {
    f.respond(req => {
      if (req.url === target) return new Response(null, { status: 302, headers: { Location: media } });
      for (const name of ['Authorization', 'Cookie', 'X-Emby-Token']) assert.equal(req.headers.has(name), false, name);
      assert.equal(req.headers.get('Range'), 'bytes=10-13');
      if (!isRelay(req)) return new Response('blocked', { status: 403 });
      assert.equal(req.headers.get('X-Relay-Target'), media);
      return new Response('test', { status: 206 });
    });
    const response = await call(f.request('/demo/Videos/test/stream', { headers: { Authorization: 'synthetic', Cookie: 'synthetic=1', 'X-Emby-Token': 'synthetic', Range: 'bytes=10-13' } }));
    assert.equal(await response.text(), 'test');
    assert.equal(response.headers.get('X-Relay-Fallback'), '1');
    assert.deepEqual(f.calls.map(req => new URL(req.url).hostname), ['api.test', 'media.test', 'relay.test']);
  } finally { f.restore(); }
});

test('personal auto: successful switch keeps signed/media redirects on VPS instead of direct/client bypass', async () => {
  const { f, call } = await setup();
  const media = 'https://download.123pan.com/path%2Ffile?sign=a%2Bb%2f%3D&k=1&k=2';
  try {
    f.respond(req => {
      if (!isRelay(req)) return new Response('blocked', { status: 403 });
      const relayTarget = req.headers.get('X-Relay-Target');
      if (relayTarget === target) return new Response(null, { status: 302, headers: { Location: media } });
      assert.equal(relayTarget, media);
      assert.equal(req.headers.get('Range'), 'bytes=10-13');
      return new Response('test', { status: 206 });
    });
    const response = await call(f.request('/demo/Videos/test/stream', { headers: { Range: 'bytes=10-13' } }));
    assert.equal(await response.text(), 'test');
    assert.equal(response.status, 206);
    assert.equal(response.headers.has('Location'), false);
    assert.deepEqual(f.calls.map(req => new URL(req.url).hostname), ['api.test', 'relay.test', 'relay.test']);
  } finally { f.restore(); }
});

test('personal auto: VPS redirect failures are returned without cycling between direct and relay', async () => {
  const { f, call } = await setup();
  try {
    f.respond(req => {
      if (!isRelay(req)) return new Response('blocked', { status: 403 });
      if (req.headers.get('X-Relay-Target') === target) return new Response(null, { status: 302, headers: { Location: 'https://media.test/file' } });
      return new Response('final VPS failure', { status: 502 });
    });
    const response = await call();
    assert.equal(response.status, 502);
    assert.equal(await response.text(), 'final VPS failure');
    assert.equal(f.calls.length, 3);
  } finally { f.restore(); }
});

test('personal auto: switched redirects still block private addresses and HTTPS downgrade', async () => {
  for (const location of ['https://127.0.0.1/secret', 'https://169.254.169.254/', 'http://media.test/file']) {
    const { f, call } = await setup();
    try {
      f.respond(req => isRelay(req) ? new Response(null, { status: 302, headers: { Location: location } }) : new Response('blocked', { status: 403 }));
      assert.equal((await call()).status, 502);
      assert.equal(f.calls.length, 2);
    } finally { f.restore(); }
  }
});

test('personal auto: a successful switch cannot expand the redirect hop budget', async () => {
  const { f, call } = await setup();
  try {
    f.respond(req => isRelay(req) ? new Response(null, { status: 302, headers: { Location: `https://api.test/hop-${f.calls.length}` } }) : new Response('blocked', { status: 403 }));
    assert.equal((await call()).status, 502);
    assert.equal(f.calls.length, 7); // one direct, one fallback, at most five redirect hops
  } finally { f.restore(); }
});

test('personal auto: redirected POST 303 retries the resulting bodyless GET, never the original write', async () => {
  const { f, call } = await setup();
  try {
    f.respond(req => {
      if (req.method === 'POST') return new Response(null, { status: 303, headers: { Location: '/result' } });
      assert.equal(req.body, null);
      assert.equal(req.headers.has('Content-Type'), false);
      assert.equal(req.headers.has('Content-Length'), false);
      if (!isRelay(req)) throw new Error('Synthetic GET connection failure');
      return new Response('result');
    });
    const response = await call(jsonPost(f, '/write', '{}'), ['https://api.test/write']);
    assert.equal(await response.text(), 'result');
    assert.deepEqual(f.calls.map(req => req.method), ['POST', 'GET', 'GET']);
  } finally { f.restore(); }
});

test('personal auto: client abort after a block does not initiate a relay retry', async () => {
  const { f, call } = await setup(), controller = new AbortController();
  try {
    f.respond(() => { controller.abort(); return new Response('blocked', { status: 403 }); });
    const response = await call(f.request('/demo/Videos/test/stream', { signal: controller.signal }));
    assert.equal(response.status, 499);
    assert.equal(f.calls.length, 1);
  } finally { f.restore(); }
});

test('personal auto: a slow successful media body is neither buffered nor retried mid-stream', async () => {
  const { f, call } = await setup();
  let source;
  try {
    f.respond(() => new Response(new ReadableStream({ start(c) { source = c; } })));
    const response = await call();
    assert.equal(response.status, 200);
    assert.equal(f.calls.length, 1);
    assert.equal(response.headers.has('X-Relay-Fallback'), false);
    source.enqueue(new TextEncoder().encode('late media')); source.close();
    assert.equal(await response.text(), 'late media');
  } finally { f.restore(); }
});
