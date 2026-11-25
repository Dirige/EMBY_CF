import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, loadEdition } from './helpers.mjs';
import { MAX_REPLAY_BYTES } from '../src/shared/proxy/body-plan.js';
import { RELAY_PREFERENCE_MS } from '../src/editions/multi/relay/preference.js';
import { relayRetryAllowed } from '../src/editions/multi/relay/mode.js';

const target = 'https://api.test/Videos/test/stream?sign=a%2Bb%2f%3D&k=1&k=2';
const settings = { relay_url: 'https://relay.test', relay_secret: 'synthetic-multi-relay-secret', relay_enabled: '1' };
const isRelay = request => new URL(request.url).hostname === 'relay.test';
const setup = async (settingOverrides = {}) => {
    const m = await loadEdition('multi'), f = fixture(m, 'multi', {}, { ...settings, ...settingOverrides });
    const call = (request = f.request('/demo/Videos/test/stream'), urls = [target], overrides = {}) =>
        m.proxyDirectUrl(request, f.env, f.ctx, urls, { enableCache: false, matchedPrefix: 'demo', routeOwner: 'alice', statPrefix: 'alice/demo', ...overrides });
    return { m, f, call };
};
const post = (f, path, body = '{"Username":"fixture","Pw":"synthetic-password"}', headers = {}) =>
    f.request('/demo' + path, { method: 'POST', body, headers: { 'Content-Type': 'application/json', ...headers } });

for (const config of [{ relay_enabled: '0' }, { relay_url: '' }, { relay_secret: '' }]) {
    test(`multi auto: disabled or incomplete global configuration never dispatches to VPS (${Object.keys(config)[0]})`, async () => {
        const { f, call } = await setup(config);
        try {
            f.respond(() => new Response('denied', { status: 403 }));
            const response = await call();
            assert.equal(response.status, 403); assert.equal(f.calls.length, 1);
            assert.equal(isRelay(f.calls[0]), false); assert.equal(response.headers.has('X-Relay-Fallback'), false);
        } finally { f.restore(); }
    });
}

for (const method of ['GET', 'HEAD']) for (const status of [401, 403, 451, 502, 504, 520, 530]) {
    test(`multi auto: ${method} ${status} switches once, retaining signed query, Range and If-Range`, async () => {
        const { f, call } = await setup();
        let discarded = false;
        try {
            f.respond(req => {
                if (!isRelay(req)) return new Response(new ReadableStream({ cancel() { discarded = true; } }), { status });
                assert.equal(req.headers.get('X-Relay-Target'), target);
                assert.equal(req.headers.get('Range'), 'bytes=10-13');
                assert.equal(req.headers.get('If-Range'), '"etag"');
                assert.match(req.headers.get('X-Relay-Auth'), /^[a-f0-9]{64}$/);
                return new Response(method === 'HEAD' ? null : 'test', { status: 206, headers: { 'Content-Range': 'bytes 10-13/100' } });
            });
            const response = await call(f.request('/demo/Videos/test/stream', { method, headers: { Range: 'bytes=10-13', 'If-Range': '"etag"' } }));
            assert.equal(response.status, 206);
            assert.equal(response.headers.get('X-Relay-Fallback'), '1');
            assert.equal(await response.text(), method === 'HEAD' ? '' : 'test');
            assert.equal(f.calls.length, 2);
            assert.equal(discarded, true);
        } finally { f.restore(); }
    });
}

for (const path of ['/emby/Users/AuthenticateByName', '/Users/AuthenticateWithQuickConnect', '/Items/test/PlaybackInfo']) {
    for (const status of [401, 403, 451]) test(`multi auto: bounded POST ${path} replays exact bytes after ${status}`, async () => {
        const { f, call } = await setup();
        const body = '{"Username":"fixture","Pw":"synthetic-password","Data":"a+%2Fb"}';
        try {
            f.respond(async req => {
                assert.equal(await req.text(), body);
                assert.equal(req.headers.get('Content-Type'), 'application/json');
                assert.equal(req.headers.get('Content-Length'), String(Buffer.byteLength(body)));
                return new Response(isRelay(req) ? 'accepted' : 'blocked', { status: isRelay(req) ? 200 : status });
            });
            assert.equal(await (await call(post(f, path, body, { 'Content-Length': String(Buffer.byteLength(body)) }), ['https://api.test' + path])).text(), 'accepted');
            assert.equal(f.calls.length, 2);
            await Promise.all(f.pending);
            assert.ok(!/synthetic-password|https:\/\//.test(JSON.stringify(f.audit)));
        } finally { f.restore(); }
    });
}

test('multi retry policy: only read failures and explicitly denied replayable login/PlaybackInfo writes qualify', () => {
    const url = new URL('https://api.test/Items/test/PlaybackInfo');
    for (const status of [500, 503, 504, 'transport']) assert.equal(relayRetryAllowed('POST', url, status, true), false);
    for (const method of ['PUT', 'PATCH', 'DELETE']) assert.equal(relayRetryAllowed(method, url, 403, true), false);
    assert.equal(relayRetryAllowed('POST', url, 403, false), false);
    for (const path of ['/Sessions/Playing', '/Sessions/Playing/Progress', '/Items/test/Update', '/Items/test/PlaybackInfo/Update']) {
        assert.equal(relayRetryAllowed('POST', new URL('https://api.test' + path), 403, true), false);
    }
});

for (const reason of [500, 503, 504, 'transport']) test(`multi auto: ambiguous POST ${reason} is never sent twice`, async () => {
    const { f, call } = await setup();
    try {
        f.respond(async req => {
            await req.text();
            if (reason === 'transport') throw new Error('Synthetic write may already have executed');
            return new Response('failed', { status: reason });
        });
        const response = await call(post(f, '/Items/test/PlaybackInfo'), ['https://api.test/Items/test/PlaybackInfo', 'https://backup.test/Items/test/PlaybackInfo']);
        assert.equal(response.status, reason === 'transport' ? 502 : reason);
        assert.equal(f.calls.length, 1);
    } finally { f.restore(); }
});

test('multi auto: unrelated and oversized uploads are one-shot, unknown small login is replayable', async () => {
    for (const [path, bytes, headers, expected] of [
        ['/Users/AuthenticateByName', new Uint8Array(MAX_REPLAY_BYTES + 5), {}, 1],
        ['/Users/AuthenticateByName', new Uint8Array(MAX_REPLAY_BYTES + 5), { 'Content-Length': '1' }, 1],
        ['/Sessions/Playing/Progress', new TextEncoder().encode('{}'), {}, 1],
        ['/Users/AuthenticateByName', new TextEncoder().encode('small unknown-length login'), {}, 2],
    ]) {
        const { f, call } = await setup();
        try {
            f.respond(async req => {
                assert.deepEqual(new Uint8Array(await req.arrayBuffer()), bytes);
                return new Response('result', { status: isRelay(req) ? 200 : 403 });
            });
            await (await call(post(f, path, bytes, headers), ['https://api.test' + path])).text();
            assert.equal(f.calls.length, expected);
        } finally { f.restore(); }
    }
});

test('multi auto: successful fallback stays preferred for reads and first-dispatch writes, without sliding cooldown', async t => {
    const { f, call } = await setup();
    let now = 1_700_000_000_000, blocked = true;
    t.mock.method(Date, 'now', () => now);
    try {
        f.respond(req => new Response(isRelay(req) || !blocked ? 'ok' : 'blocked', { status: isRelay(req) || !blocked ? 200 : 403 }));
        await (await call()).text();
        now += RELAY_PREFERENCE_MS - 1;
        await (await call(post(f, '/Items/test/PlaybackInfo'), ['https://api.test/Items/test/PlaybackInfo'])).text();
        now += 2; blocked = false;
        await (await call()).text();
        await (await call()).text();
        assert.deepEqual(f.calls.map(isRelay), [false, true, true, false, false]);
    } finally { f.restore(); }
});

test('multi auto: one recovery read probes; simultaneous reads/writes remain on VPS', async t => {
    const { f, call } = await setup();
    let now = 1_700_000_000_000, release, started;
    t.mock.method(Date, 'now', () => now);
    const ready = new Promise(resolve => { started = resolve; });
    try {
        f.respond(req => new Response('result', { status: isRelay(req) ? 200 : 403 }));
        await (await call()).text(); now += RELAY_PREFERENCE_MS + 1;
        f.respond(req => isRelay(req) ? new Response('preferred') : new Promise(resolve => { release = resolve; started(); }));
        const probing = call(); await ready;
        assert.equal(await (await call()).text(), 'preferred');
        assert.equal(await (await call(post(f, '/Items/test/PlaybackInfo'), ['https://api.test/Items/test/PlaybackInfo'])).text(), 'preferred');
        release(new Response('recovered')); await (await probing).text();
        f.respond(() => new Response('direct')); await (await call()).text();
        assert.deepEqual(f.calls.map(isRelay), [false, true, false, true, true, false]);
    } finally { release?.(new Response('cleanup')); f.restore(); }
});

test('multi auto: preference isolates owner, route, incoming host, source origin and CF region', async () => {
    const { f, call } = await setup();
    const request = (host = 'alice.example.test', colo = 'NRT', country = 'CN') => {
        const req = f.request('/demo/Videos/test/stream', {}, 'https://' + host);
        Object.defineProperty(req, 'cf', { value: { colo, country } });
        return req;
    };
    try {
        f.respond(req => new Response('result', { status: isRelay(req) ? 200 : 403 }));
        await (await call(request())).text();
        f.respond(() => new Response('direct'));
        for (const [req, urls, overrides] of [
            [request(), [target], { routeOwner: 'bob' }], [request(), [target], { matchedPrefix: 'other' }],
            [request('bob.example.test'), [target], {}], [request('alice.example.test', 'SIN'), [target], {}],
            [request('alice.example.test', 'NRT', 'SG'), [target], {}], [request(), ['https://backup.test/file'], {}],
        ]) {
            await (await call(req, urls, overrides)).text(); assert.equal(isRelay(f.calls.at(-1)), false);
        }
        await (await call(request())).text(); assert.equal(isRelay(f.calls.at(-1)), true);
    } finally { f.restore(); }
});

for (const method of ['GET', 'POST']) test(`multi auto: preferred VPS quota/transport failure never cycles (${method})`, async () => {
    for (const transport of [false, true]) {
        const { f, call } = await setup();
        try {
            f.respond(req => new Response('ok', { status: isRelay(req) ? 200 : 403 }));
            await (await call()).text();
            f.respond(req => {
                if (!isRelay(req)) return new Response('direct');
                if (transport) throw new Error('Synthetic uncertain result');
                return new Response('quota', { status: 503, headers: { 'X-Relay-Denied': 'quota' } });
            });
            const response = await call(method === 'POST' ? post(f, '/Items/test/PlaybackInfo') : undefined,
                method === 'POST' ? ['https://api.test/Items/test/PlaybackInfo'] : undefined);
            assert.equal(response.status, method === 'GET' ? 200 : transport ? 502 : 503);
            assert.deepEqual(f.calls.map(isRelay), method === 'GET' ? [false, true, true, false] : [false, true, true]);
        } finally { f.restore(); }
    }
});

test('multi auto: independent stream 302 mapping preserves the VPS path and safe API Referer', async () => {
    const { f, call } = await setup();
    const media = 'https://media.test/opaque%2Ffile?sign=a%2Bb%2f%3D&k=1&k=2';
    try {
        f.respond(req => {
            if (!isRelay(req)) return new Response('blocked', { status: 403 });
            if (req.headers.get('X-Relay-Target') === target) return new Response(null, { status: 302, headers: { Location: media } });
            assert.equal(req.headers.get('X-Relay-Target'), media);
            assert.equal(req.headers.get('Authorization'), null);
            assert.equal(req.headers.get('Referer'), 'https://api.test/web/index.html');
            assert.equal(req.headers.get('Range'), 'bytes=10-13');
            return new Response('test', { status: 206 });
        });
        const redirect = await call(undefined, undefined, { streamTargets: ['https://media.test'], streamProxyPath: '/demo' });
        assert.equal(redirect.status, 302);
        const mapped = redirect.headers.get('Location');
        assert.equal(mapped, 'https://alice.example.test/demo/__stream/0/opaque%2Ffile?sign=a%2Bb%2f%3D&k=1&k=2');
        const response = await f.serve(new Request(mapped, { headers: { Range: 'bytes=10-13', Authorization: 'synthetic' } }));
        assert.equal(await response.text(), 'test');
        assert.deepEqual(f.calls.map(isRelay), [false, true, true]);
    } finally { f.restore(); }
});

test('multi auto: relayed PlaybackInfo maps media URLs and carries preference into the next stream request', async () => {
    const { f, call } = await setup();
    const media = 'https://media.test/file?sign=a%2Bb%2f%3D';
    try {
        f.respond(req => {
            if (!isRelay(req)) return new Response('blocked', { status: 403 });
            if (req.method === 'POST') return Response.json({ MediaSources: [{ DirectStreamUrl: media }] });
            assert.equal(req.headers.get('X-Relay-Target'), media);
            return new Response('media');
        });
        const response = await call(post(f, '/Items/test/PlaybackInfo'), ['https://api.test/Items/test/PlaybackInfo'], { streamTargets: ['https://media.test'], streamProxyPath: '/demo' });
        const data = await response.json();
        assert.equal(data.MediaSources[0].DirectStreamUrl, 'https://alice.example.test/demo/__stream/0/file?sign=a%2Bb%2f%3D');
        await (await f.serve(new Request(data.MediaSources[0].DirectStreamUrl))).text();
        assert.deepEqual(f.calls.map(isRelay), [false, true, true]);
    } finally { f.restore(); }
});

test('multi auto: non-mapped signed redirects stay on VPS; private/downgrade/loop chains remain blocked', async () => {
    const media = 'https://download.123pan.com/opaque%2Ffile?sign=a%2Bb%2f%3D&k=1&k=2';
    for (const location of [media, 'https://127.0.0.1/secret', 'http://media.test/file', 'loop']) {
        const { f, call } = await setup();
        try {
            f.respond(req => {
                if (!isRelay(req)) return new Response('blocked', { status: 403 });
                if (location === 'loop' || req.headers.get('X-Relay-Target') === target) {
                    return new Response(null, { status: 302, headers: { Location: location === 'loop' ? 'https://api.test/hop-' + f.calls.length : location } });
                }
                assert.equal(req.headers.get('X-Relay-Target'), media);
                for (const name of ['Authorization', 'Cookie', 'X-Emby-Token']) assert.equal(req.headers.has(name), false);
                return new Response('signed result');
            });
            const response = await call(f.request('/demo/Videos/test/stream', { headers: { Authorization: 'synthetic', Cookie: 'synthetic=1', 'X-Emby-Token': 'synthetic' } }));
            assert.equal(response.status, location === media ? 200 : 502);
            if (location === media) assert.equal(await response.text(), 'signed result');
            assert.equal(f.calls.length, location === media ? 3 : location === 'loop' ? 7 : 2);
        } finally { f.restore(); }
    }
});

test('multi auto: a redirected POST 303 retries only the bodyless GET; client abort never retries', async () => {
    const { f, call } = await setup();
    try {
        f.respond(req => {
            if (req.method === 'POST') return new Response(null, { status: 303, headers: { Location: '/result' } });
            assert.equal(req.body, null); assert.equal(req.headers.has('Content-Type'), false);
            if (!isRelay(req)) throw new Error('Synthetic read failure');
            return new Response('result');
        });
        assert.equal(await (await call(post(f, '/write'), ['https://api.test/write'])).text(), 'result');
        assert.deepEqual(f.calls.map(req => req.method), ['POST', 'GET', 'GET']);
    } finally { f.restore(); }
    const next = await setup(), abort = new AbortController();
    try {
        next.f.respond(() => { abort.abort(); return new Response('blocked', { status: 403 }); });
        assert.equal((await next.call(next.f.request('/demo/Videos/test/stream', { signal: abort.signal }))).status, 499);
        assert.equal(next.f.calls.length, 1);
    } finally { next.f.restore(); }
});

test('multi auto: a slow successful movie is streamed without buffering or midstream redispatch', async () => {
    const { f, call } = await setup(); let source;
    try {
        f.respond(() => new Response(new ReadableStream({ start(c) { source = c; } })));
        const response = await call();
        assert.equal(response.status, 200); assert.equal(f.calls.length, 1);
        assert.equal(response.headers.has('X-Relay-Fallback'), false);
        source.enqueue(new TextEncoder().encode('late movie')); source.close();
        assert.equal(await response.text(), 'late movie'); assert.equal(f.calls.length, 1);
    } finally { f.restore(); }
});
