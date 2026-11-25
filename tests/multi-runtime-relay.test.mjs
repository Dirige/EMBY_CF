import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Response as RuntimeResponse, WebSocketPair } from 'miniflare';
import { multiRuntime, legacyCookie } from './multi-runtime-helpers.mjs';

const relaySecret = 'synthetic-multi-relay-secret';
const relayConfig = { relay_url: 'https://relay.test', relay_secret: relaySecret, relay_enabled: '1' };
const isRelay = request => new URL(request.url).hostname === 'relay.test';
function verifyRelay(request) {
    const target = request.headers.get('X-Relay-Target');
    assert.ok(target);
    assert.equal(request.headers.get('X-Relay-Auth'), createHmac('sha256', relaySecret).update(request.headers.get('X-Relay-Ts') + ':' + target).digest('hex'));
    return target;
}
async function initialize(f) {
    await f.seedUser('alice', 1); await f.seedUser('bob', 2);
    await f.db.batch([
        f.db.prepare("INSERT INTO user_routes (owner,prefix,target,stream_target,ip_mode) VALUES ('alice','demo','https://api.test','https://media.test','strip'),('alice','fresh','https://api.test','','strip'),('bob','demo','https://api.test','https://media.test','strip')"),
    ]);
    assert.equal((await f.post('/admin/api/relay', relayConfig, legacyCookie(0))).status, 200);
}

test('multi/workerd relay: safe POST replay, signed Range, independent PlaybackInfo streams, tenant preference and global disable', { timeout: 30000 }, async t => {
    let calls = [], reason = 403;
    const body = '{"Username":"synthetic-user","Pw":"synthetic-password","Data":"a+%2Fb"}';
    const media = 'https://media.test/opaque%2Ffile?sign=a%2Bb%2f%3D&k=1&k=2';
    const f = await multiRuntime({ outbound: async request => {
        calls.push(request);
        assert.equal(request.headers.has('Cookie'), false);
        assert.equal(request.headers.has('X-Forwarded-For'), false);
        const target = isRelay(request) ? verifyRelay(request) : request.url;
        if (request.method === 'POST' && /AuthenticateByName/.test(target)) assert.equal(await request.text(), body);
        if (!isRelay(request)) {
            if (reason === 'transport') throw new Error('Synthetic uncertain write');
            return new Response('denied', { status: reason });
        }
        if (/PlaybackInfo/.test(target)) return Response.json({ MediaSources: [{ DirectStreamUrl: media }] });
        if (request.headers.has('Range')) {
            assert.equal(request.headers.get('Range'), 'bytes=10-13');
            assert.equal(request.headers.get('If-Range'), '"synthetic-etag"');
            return new Response(request.method === 'HEAD' ? null : 'test', { status: 206, headers: { 'Content-Range': 'bytes 10-13/100', 'Accept-Ranges': 'bytes', 'Content-Length': '4' } });
        }
        return new Response('accepted');
    } });
    const fetch = (path, init = {}, user = 'alice') => f.mf.dispatchFetch('https://' + user + '.example.test/' + path, { redirect: 'manual', ...init });
    try {
        await initialize(f);
        await t.test('explicit POST denial replays exact bytes and not the management cookie', async () => {
            const response = await fetch('demo/Users/AuthenticateByName', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'admin_session=synthetic' }, body });
            assert.equal(response.status, 200); assert.equal(await response.text(), 'accepted');
            assert.deepEqual(calls.map(isRelay), [false, true]);
            assert.equal(response.headers.get('X-Relay-Fallback'), '1');
        });
        await t.test('native GET/HEAD Range and If-Range retain the signed target on the preferred VPS', async () => {
            for (const method of ['GET', 'HEAD']) {
                calls = [];
                const response = await fetch('demo/Videos/test/stream?sign=a%2Bb%2f%3D&k=1&k=2', { method, headers: { Range: 'bytes=10-13', 'If-Range': '"synthetic-etag"' } });
                assert.equal(response.status, 206); assert.equal(response.headers.get('Content-Range'), 'bytes 10-13/100');
                assert.equal(await response.text(), method === 'HEAD' ? '' : 'test');
                assert.deepEqual(calls.map(isRelay), [true]);
                assert.equal(calls[0].headers.get('X-Relay-Target'), 'https://api.test/Videos/test/stream?sign=a%2Bb%2f%3D&k=1&k=2');
            }
        });
        await t.test('relayed PlaybackInfo maps the media URL and transfers its preference to an independent media host', async () => {
            calls = [];
            const data = await fetch('demo/Items/test/PlaybackInfo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.json());
            assert.equal(data.MediaSources[0].DirectStreamUrl, 'https://alice.example.test/demo/__stream/0/opaque%2Ffile?sign=a%2Bb%2f%3D&k=1&k=2');
            const response = await f.mf.dispatchFetch(data.MediaSources[0].DirectStreamUrl, { headers: { Cookie: 'media_auth=synthetic', Authorization: 'synthetic-player-token', Range: 'bytes=10-13', 'If-Range': '"synthetic-etag"' } });
            assert.equal(response.status, 206); assert.equal(await response.text(), 'test');
            assert.deepEqual(calls.map(isRelay), [true, true]);
            assert.equal(calls[1].headers.get('X-Relay-Target'), media);
            assert.equal(calls[1].headers.has('Authorization'), false);
            assert.equal(calls[1].headers.get('Referer'), 'https://api.test/web/index.html');
        });
        await t.test('a sibling user sharing the same upstream gets their own direct probe', async () => {
            calls = [];
            assert.equal((await fetch('demo/System/Ping', {}, 'bob')).status, 200);
            assert.deepEqual(calls.map(isRelay), [false, true]);
        });
        await t.test('new-route ambiguous login writes and unrelated progress writes never replay', async () => {
            // Throwing inside Miniflare's Node service adapter becomes an HTTP
            // 500, not a fetch rejection. Actual thrown-fetch retry exclusions
            // are covered separately by multi-relay-failover.test.mjs.
            for (const status of [500, 503, 504]) {
                reason = status; calls = [];
                const response = await fetch('fresh/Users/AuthenticateByName', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
                assert.equal(response.status, status);
                assert.deepEqual(calls.map(isRelay), [false]);
            }
            reason = 403; calls = [];
            assert.equal((await fetch('fresh/Sessions/Playing/Progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
            assert.deepEqual(calls.map(isRelay), [false]);
        });
        await t.test('turning off the existing global switch suppresses even a cached VPS preference', async () => {
            assert.equal((await f.post('/admin/api/relay', { ...relayConfig, relay_enabled: '0' }, legacyCookie(0))).status, 200);
            calls = [];
            const response = await fetch('demo/System/Ping');
            assert.equal(response.status, 403); assert.equal(response.headers.has('X-Relay-Fallback'), false);
            assert.deepEqual(calls.map(isRelay), [false]);
        });
    } finally { await f.mf.dispose(); }
});

test('multi/workerd WebSocket: denied upgrade falls back to a real VPS socket, preserves policy and isolates tenant preference', { timeout: 30000 }, async () => {
    let calls = [];
    const sockets = [];
    const f = await multiRuntime({ outbound: async request => {
        calls.push(request);
        assert.equal(request.headers.get('Upgrade'), 'websocket');
        assert.equal(request.headers.has('Cookie'), false); assert.equal(request.headers.has('X-Forwarded-For'), false);
        // Miniflare's Node adapter detaches an upgraded HTTP parser even when
        // the upgrade is denied. Close that synthetic connection explicitly so
        // a second outbound upgrade cannot be queued on the detached socket.
        if (!isRelay(request)) return new Response('denied', { status: 403, headers: { Connection: 'close' } });
        assert.equal(verifyRelay(request), 'https://api.test/socket');
        const [client, server] = Object.values(new WebSocketPair());
        server.accept(); sockets.push(server);
        server.addEventListener('message', event => server.send(event.data));
        server.addEventListener('close', () => server.close());
        return new RuntimeResponse(null, { status: 101, webSocket: client });
    } });
    try {
        await initialize(f);
        for (const [user, expected] of [['alice', [false, true]], ['alice', [true]], ['bob', [false, true]]]) {
            calls = [];
            const response = await f.mf.dispatchFetch('https://' + user + '.example.test/demo/socket', { headers: { Upgrade: 'websocket', Cookie: 'admin_session=synthetic' } });
            assert.equal(response.status, 101, JSON.stringify({ user, requests: calls.map(request => ({ url: request.url, target: request.headers.get('X-Relay-Target'), upgrade: request.headers.get('Upgrade') })), socketCount: sockets.length }));
            assert.deepEqual(calls.map(isRelay), expected);
            const socket = response.webSocket; socket.accept(); sockets.push(socket);
            let timer;
            const received = new Promise((resolve, reject) => {
                timer = setTimeout(() => reject(new Error('Synthetic WebSocket echo timeout')), 3000);
                socket.addEventListener('message', event => resolve(event.data), { once: true });
            });
            socket.send('synthetic message');
            try { assert.equal(await received, 'synthetic message'); } finally { clearTimeout(timer); socket.close(); }
        }
        await f.post('/admin/api/relay', { ...relayConfig, relay_enabled: '0' }, legacyCookie(0)); calls = [];
        assert.equal((await f.mf.dispatchFetch('https://alice.example.test/demo/socket', { headers: { Upgrade: 'websocket' } })).status, 403);
        assert.deepEqual(calls.map(isRelay), [false]);
    } finally {
        for (const socket of sockets) { try { socket.close(); } catch {} }
        await f.mf.dispose();
    }
});
