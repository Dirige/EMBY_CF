import test from 'node:test';
import assert from 'node:assert/strict';
import { multiRuntime, origin, rootPassword, legacyCookie, passwordRecord } from './multi-runtime-helpers.mjs';

test('multi/workerd: confidential notifications, native D1 password epochs and per-account authorization', { timeout: 90000 }, async t => {
    const calls = [];
    let upstreamOk = false, relayOk = true, relayOversized = false;
    const botToken = '123456:synthetic-new-token';
    const f = await multiRuntime({ peers: true,
        bindings: { TELEGRAM_BOT_TOKEN: '555555:legacy-token', TELEGRAM_CHAT_ID: '55555', NOTIFY_WEBHOOK: 'https://webhook.test/private' },
        outbound: async request => {
            const url = new URL(request.url), body = request.method === 'POST' ? await request.text() : '';
            calls.push({ url: request.url, body });
            if (url.hostname === 'api.telegram.org' || url.hostname === 'webhook.test') return Response.json({ ok: true });
            if (url.hostname === 'relay.test') return Response.json({ ok: relayOk, version: 'synthetic-relay', usage: { padding: 'x'.repeat(relayOversized ? 20000 : 800) } });
            return new Response('synthetic upstream', { status: upstreamOk ? 200 : 503 });
        },
    });
    const { mf, db, get, post, login, seedUser } = f;
    let cookie;
    try {
        await seedUser('alice', 1); await seedUser('bob', 2); await seedUser('operator', 3, 'admin');
        const aliceLegacy = legacyCookie(1), bobLegacy = legacyCookie(2), adminLegacy = legacyCookie(0, true);
        const peer = await mf.getWorker('peer');
        const peerGet = (path, session) => peer.fetch(origin + path, { headers: { Cookie: session }, redirect: 'manual' });
        await t.test('pre-upgrade ordinary and two-part admin sessions stay valid until their own password changes', async () => {
            for (const session of [aliceLegacy, bobLegacy, adminLegacy]) assert.equal((await get('/api/user/me', session)).status, 200);
            assert.equal((await peerGet('/api/user/me', aliceLegacy)).status, 200);
            cookie = (await login()).cookie; assert.ok(cookie);
        });
        await t.test('notification/security endpoints require auth and same-origin JSON, including logout', async () => {
            assert.equal((await post('/admin/api/notifications', { clear: true })).status, 401);
            assert.equal((await post('/admin/api/notifications', { clear: true }, aliceLegacy)).status, 401);
            assert.equal((await post('/admin/api/notifications', { clear: true }, cookie, { Origin: 'https://evil.test' })).status, 403);
            assert.equal((await post('/admin/api/security/password', {}, cookie, { Origin: '' })).status, 403);
            assert.equal((await post('/api/user/password', {}, aliceLegacy, { Origin: '' })).status, 403);
            assert.equal((await post('/admin/api/logout', {}, cookie, { Origin: 'https://evil.test' })).status, 403);
            assert.equal((await post('/admin/api/login', { token: rootPassword }, '', { Origin: 'https://evil.test' })).status, 403);
        });
        await t.test('web Telegram config derives a purpose-specific key without changing Worker bindings; no secrets in GET/export', async () => {
            const saved = await post('/admin/api/notifications', { token: botToken, chatId: '-100123456' }, cookie);
            assert.equal(saved.status, 200);
            const status = await saved.json(); assert.equal(status.source, 'web'); assert.equal(status.telegram, true);
            const row = await db.prepare("SELECT value FROM multi_private WHERE key = 'telegram'").first();
            assert.equal(JSON.parse(row.value).keySource, 'session');
            assert.ok(!row.value.includes(botToken) && !row.value.includes('-100123456'));
            for (const path of ['/admin/api/notifications', '/admin/api/settings', '/admin/api/export']) {
                const response = await get(path, cookie);
                assert.equal(response.headers.get('Cache-Control'), 'no-store');
                assert.ok(!/synthetic-new-token|ciphertext|user_epoch:/.test(await response.text()));
            }
        });
        await t.test('blank Token preserves it, explicit clear suppresses fallback, corruption fails closed', async () => {
            assert.equal((await post('/admin/api/notifications', { token: '', chatId: '-100999' }, cookie)).status, 200);
            calls.length = 0;
            assert.equal((await post('/admin/api/notifications/test', {}, cookie)).status, 200);
            assert.equal(calls.length, 1); assert.ok(calls[0].url.includes(botToken));
            assert.equal(JSON.parse(calls[0].body).chat_id, '-100999');
            await post('/admin/api/notifications', { clear: true }, cookie); calls.length = 0;
            assert.equal((await post('/admin/api/notifications/test', {}, cookie)).status, 502); assert.equal(calls.length, 0);
            await post('/admin/api/notifications', { token: botToken, chatId: '-100123456' }, cookie);
            const before = await db.prepare("SELECT value FROM multi_private WHERE key = 'telegram'").first();
            await db.prepare("UPDATE multi_private SET value = 'corrupt' WHERE key = 'telegram'").run(); calls.length = 0;
            assert.equal((await post('/admin/api/notifications/test', {}, cookie)).status, 502); assert.equal(calls.length, 0);
            assert.equal((await get('/admin/api/notifications', cookie).then(r => r.json())).telegram, false);
            await db.prepare("UPDATE multi_private SET value = ? WHERE key = 'telegram'").bind(before.value).run();
        });
        await t.test('settings/import cannot overwrite private data; relay secrets have no partial hints or export', async () => {
            const before = await db.prepare("SELECT value FROM multi_private WHERE key = 'telegram'").first();
            await post('/admin/api/settings', { telegram: 'attacker', admin_password: 'attacker', 'user_epoch:1': 'attacker' }, cookie);
            await post('/admin/api/import', { settings: { telegram: 'attacker', admin_password: 'attacker' } }, cookie);
            assert.equal((await db.prepare("SELECT value FROM multi_private WHERE key = 'telegram'").first()).value, before.value);
            await post('/admin/api/relay', { relay_url: 'https://relay.test', relay_secret: 'synthetic-relay-secret-private', relay_enabled: '0' }, cookie);
            for (const path of ['/admin/api/settings', '/admin/api/export', '/admin/api/relay']) {
                assert.ok(!(await get(path, cookie).then(r => r.text())).includes('synthetic-relay-secret-private'));
            }
            const publicSettings = await get('/admin/api/settings', cookie).then(r => r.json());
            assert.equal('relay_secret' in publicSettings.settings, false);
        });
        await t.test('relay health parses complete bounded JSON and rejects HTTP-200/body-false and oversized responses', async () => {
            relayOk = false;
            let out = await post('/admin/api/relay/test', {}, cookie).then(r => r.json());
            assert.equal(out.ok, false); assert.ok(out.error);
            assert.equal((await get('/admin/api/relay', cookie).then(r => r.json())).active, false);
            relayOk = true; relayOversized = true;
            out = await post('/admin/api/relay/test', {}, cookie).then(r => r.json()); assert.equal(out.ok, false);
            relayOversized = false;
            out = await post('/admin/api/relay/test', {}, cookie).then(r => r.json());
            assert.equal(out.ok, true); assert.equal(out.version, 'synthetic-relay'); assert.equal(out.usage.padding.length, 800);
            assert.equal(out.auto_enabled, true);
            assert.equal((await get('/admin/api/relay/usage', cookie).then(r => r.json())).ok, true);
        });
        await t.test('diagnostics/import preview respect created_by ownership and never probe another admin route', async () => {
            await db.prepare("INSERT INTO routes (prefix,target,created_by) VALUES ('owned','https://owned.test','admin'),('other','https://other.test','operator')").run();
            calls.length = 0;
            assert.equal((await post('/admin/api/routes/diagnose', { prefix: 'other' }, cookie)).status, 404);
            assert.equal(calls.length, 0);
            const plan = await post('/admin/api/import/preview', { routes: [{ prefix: 'other', target: 'https://replacement.test' }] }, cookie).then(r => r.json());
            assert.equal(plan.canImport, false); assert.equal(plan.overwritten.length, 0);
            const exported = await get('/admin/api/export', cookie).then(r => r.json());
            assert.ok(exported.routes.some(r => r.prefix === 'owned')); assert.ok(!exported.routes.some(r => r.prefix === 'other'));
            await db.prepare("DELETE FROM routes WHERE prefix IN ('owned','other')").run();
        });
        await t.test('user and global health states are isolated; unsafe remarks never reveal usernames, URLs or errors', async () => {
            await db.prepare("INSERT INTO routes (prefix,target,remark,created_by) VALUES ('global-private','https://global-secret.test/private?token=hidden','https://unsafe.test','admin')").run();
            await db.prepare("INSERT INTO user_routes (owner,prefix,target,remark) VALUES ('alice','same','https://alice-secret.test/path?token=hidden','alice'),('bob','same','https://bob-secret.test/path?token=hidden','影院 & <节点>')").run();
            calls.length = 0;
            assert.equal((await post('/admin/api/health/run', {}, cookie).then(r => r.json())).alerts.length, 0);
            const down = await post('/admin/api/health/run', {}, cookie).then(r => r.json());
            assert.equal(down.alerts.length, 3);
            const alice = await get('/api/user/routes', aliceLegacy).then(r => r.json());
            const bob = await get('/api/user/routes', bobLegacy).then(r => r.json());
            assert.equal(alice.length, 1); assert.equal(bob.length, 1); assert.equal(alice[0].down_count, 1);
            assert.notEqual(alice[0].notification_id, bob[0].notification_id);
            assert.ok(down.alerts.some(text => text.includes(alice[0].notification_id)));
            assert.ok(down.alerts.some(text => text.includes('影院 &amp; &lt;节点&gt;')));
            upstreamOk = true;
            const restored = await post('/admin/api/health/run', {}, cookie).then(r => r.json());
            assert.equal(restored.alerts.length, 3); assert.ok(restored.alerts.some(text => text.includes(alice[0].notification_id)));
            for (const call of calls.filter(c => /api.telegram.org|webhook.test/.test(c.url))) {
                assert.ok(!/https?:|alice|bob|global-private|secret\.test|hidden|503/.test(call.body));
            }
            const last = await get('/admin/api/notifications', cookie).then(r => r.json()); assert.equal(last.last.kind, 'health');
        });
        await t.test('disabled alerts still update state, daily report never includes hosts or raw errors', async () => {
            await post('/admin/api/settings', { tg_route_alerts: '0' }, cookie); upstreamOk = false; calls.length = 0;
            await post('/admin/api/health/run', {}, cookie);
            assert.equal((await post('/admin/api/health/run', {}, cookie).then(r => r.json())).alerts.length, 3);
            assert.equal(calls.filter(c => /api.telegram.org|webhook.test/.test(c.url)).length, 0);
            const daily = await post('/admin/api/report/send', {}, cookie).then(r => r.json());
            assert.equal(daily.success, true); assert.ok(!/https?:|example\.test|private|secret\.test/.test(daily.preview));
            assert.match(daily.preview, /请登录后台检查统计配置/);
        });
        await t.test('proxy XFO can be disabled/denied, but management HTML always stays SAMEORIGIN', async () => {
            await post('/admin/api/settings', { x_frame_options: 'off' }, cookie);
            const response = await f.fetch('/global-private/Videos/test/stream');
            assert.equal(response.headers.has('X-Frame-Options'), false);
            assert.equal((await get('/admin', cookie)).headers.get('X-Frame-Options'), 'SAMEORIGIN');
            await post('/admin/api/settings', { x_frame_options: 'deny' }, cookie);
            assert.equal((await f.fetch('/global-private/Videos/test/stream')).headers.get('X-Frame-Options'), 'DENY');
        });
        await t.test('wrong, short, mismatched or cross-account password changes cannot update credentials', async () => {
            const change = data => post('/api/user/password', data, aliceLegacy);
            assert.equal((await change({ currentPassword: 'wrong', newPassword: 'synthetic-new-user-password' })).status, 403);
            assert.equal((await change({ currentPassword: 'synthetic-user-password', newPassword: 'short' })).status, 400);
            assert.equal((await change({ currentPassword: 'synthetic-user-password', newPassword: 'synthetic-new-user-password', confirmPassword: 'different' })).status, 400);
            const before = await db.prepare('SELECT password_hash FROM users WHERE id = 2').first();
            assert.equal((await change({ uid: 2, currentPassword: 'synthetic-user-password', newPassword: 'synthetic-alice-password' })).status, 200);
            assert.equal((await db.prepare('SELECT password_hash FROM users WHERE id = 2').first()).password_hash, before.password_hash);
        });
        let aliceCookie;
        await t.test('ordinary user change revokes all their sessions across isolates, without revoking others or accepting the old password', async () => {
            assert.equal((await get('/api/user/me', aliceLegacy)).status, 401);
            assert.equal((await peerGet('/api/user/me', aliceLegacy)).status, 401);
            for (const session of [bobLegacy, cookie, adminLegacy]) assert.equal((await get('/api/user/me', session)).status, 200);
            assert.equal((await login('alice', 'synthetic-user-password')).response.status, 401);
            aliceCookie = (await login('alice', 'synthetic-alice-password')).cookie; assert.ok(aliceCookie);
            assert.equal((await get('/api/user/me', aliceCookie)).status, 200);
            const record = await db.prepare("SELECT value FROM multi_private WHERE key = 'user_epoch:1'").first(); assert.match(record.value, /^[a-f0-9]{64}$/);
        });
        await t.test('ordinary user compare-and-swap password changes allow only one concurrent winner', async () => {
            const change = password => post('/api/user/password', { currentPassword: 'synthetic-alice-password', newPassword: password }, aliceCookie);
            const responses = await Promise.all([change('synthetic-concurrent-password-A'), change('synthetic-concurrent-password-B')]);
            assert.equal(responses.filter(r => r.status === 200).length, 1);
            assert.ok(responses.every(r => [200, 401, 403, 409].includes(r.status)));
            const winner = responses[0].status === 200 ? 'synthetic-concurrent-password-A' : 'synthetic-concurrent-password-B';
            aliceCookie = (await login('alice', winner)).cookie; assert.ok(aliceCookie);
        });
        await t.test('admin reset rotates only that user epoch, and role/status changes are not hidden by stale session caches', async () => {
            const update = await f.fetch('/admin/api/users/2', { method: 'PUT', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'synthetic-admin-reset-password' }) });
            assert.equal(update.status, 200);
            assert.equal((await peerGet('/api/user/me', bobLegacy)).status, 401);
            assert.equal((await get('/api/user/me', aliceCookie)).status, 200);
            assert.equal((await login('bob', 'synthetic-user-password')).response.status, 401);
            const bobCookie = (await login('bob', 'synthetic-admin-reset-password')).cookie; assert.ok(bobCookie);
            assert.equal((await peerGet('/api/user/me', bobCookie)).status, 200);
            await db.prepare("UPDATE users SET status = 'disabled' WHERE id = 2").run();
            assert.equal((await peerGet('/api/user/me', bobCookie)).status, 401);
            await db.prepare("UPDATE users SET status = 'active' WHERE id = 2").run();
        });
        await t.test('a password reset between validation and token issuance cannot mint a current session for an old password', async () => {
            const next = passwordRecord('synthetic-race-reset-password', 'ffeeddccbbaa99887766554433221100');
            await db.prepare(`CREATE TRIGGER fixture_login_password_race AFTER UPDATE OF last_login ON users
                WHEN NEW.id = 2 BEGIN UPDATE users SET password_hash = '${next.hash}', salt = '${next.salt}' WHERE id = 2; END`).run();
            const logged = await login('bob', 'synthetic-admin-reset-password'); assert.equal(logged.response.status, 200);
            assert.equal((await get('/api/user/me', logged.cookie)).status, 401);
            await db.prepare('DROP TRIGGER fixture_login_password_race').run();
        });
        await t.test('database-backed admins change only their own password, not the built-in ADMIN_TOKEN', async () => {
            const operator = await login('operator');
            assert.equal(operator.response.status, 401);
            const logged = await login('operator', 'synthetic-user-password'); assert.ok(logged.cookie);
            assert.equal((await post('/admin/api/security/password', { currentPassword: 'synthetic-user-password', newPassword: 'synthetic-operator-new-password' }, logged.cookie)).status, 200);
            assert.equal((await get('/admin/api/settings', logged.cookie)).status, 401);
            assert.equal((await get('/admin/api/settings', cookie)).status, 200);
        });
        await t.test('built-in admin change revokes old two/three-part sessions while leaving users untouched; no second environment password', async () => {
            const next = '  synthetic-new-admin-password  ';
            assert.equal((await post('/admin/api/security/password', { currentPassword: rootPassword, newPassword: next, confirmPassword: next }, cookie)).status, 200);
            assert.equal((await get('/admin/api/settings', cookie)).status, 401);
            assert.equal((await get('/admin/api/settings', adminLegacy)).status, 401);
            assert.equal((await peerGet('/admin/api/settings', adminLegacy)).status, 401);
            assert.equal((await get('/api/user/me', aliceCookie)).status, 200);
            assert.equal((await login()).response.status, 401);
            assert.equal((await login('admin', next.trim())).response.status, 401);
            const logged = await login('admin', next); assert.equal(logged.response.status, 200); cookie = logged.cookie;
            const record = await db.prepare("SELECT value FROM multi_private WHERE key = 'admin_password'").first();
            assert.equal(JSON.parse(record.value).iterations, 100000);
            assert.ok(!record.value.includes(next) && !record.value.includes(rootPassword));
            for (const path of ['/admin/api/settings', '/admin/api/export', '/admin/api/audit']) {
                const text = await get(path, cookie).then(r => r.text()); assert.ok(!text.includes(next) && !text.includes(JSON.parse(record.value).hash));
            }
        });
        await t.test('built-in admin concurrent changes are conditional; corrupt records fail closed without affecting users', async () => {
            const change = password => post('/admin/api/security/password', { currentPassword: '  synthetic-new-admin-password  ', newPassword: password }, cookie);
            const responses = await Promise.all([change('synthetic-admin-concurrent-A'), change('synthetic-admin-concurrent-B')]);
            assert.equal(responses.filter(r => r.status === 200).length, 1);
            await db.prepare("UPDATE multi_private SET value = 'broken' WHERE key = 'admin_password'").run();
            assert.equal((await login()).response.status, 503);
            assert.equal((await get('/api/user/me', aliceCookie)).status, 200);
            assert.equal((await get('/admin/api/settings', cookie)).status, 401);
        });
    } finally { await mf.dispose(); }
});
