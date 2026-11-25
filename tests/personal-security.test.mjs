import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel } from 'miniflare';
import { root, textAssets } from '../scripts/build.mjs';

test('personal/workerd: private notification configuration, confidential alerts and password lifecycle', { timeout: 90000 }, async t => {
    const compiled = await build({ entryPoints: [`${root}/src/personal.js`], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false, plugins: [textAssets] });
    const calls = [];
    let upstreamOk = false;
    let relayOk = true;
    const rootPassword = 'fixture-original-admin-token';
    const botToken = '123456:fixture_BOT-token';
    const mf = new Miniflare({
        host: '127.0.0.1', port: 0, modules: true, script: compiled.outputFiles[0].text,
        compatibilityDate: '2025-05-15', compatibilityFlags: ['nodejs_compat'],
        bindings: {
            ADMIN_TOKEN: rootPassword, SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 19).toString('base64'),
            TELEGRAM_BOT_TOKEN: '555555:legacy-token', TELEGRAM_CHAT_ID: '55555', NOTIFY_WEBHOOK: 'https://webhook.test/private', DISABLE_DIRECT_PROXY: '1'
        },
        d1Databases: { DB: 'security-test' }, log: new Log(LogLevel.ERROR),
        outboundService: async request => {
            const url = new URL(request.url);
            const body = request.method === 'POST' ? await request.text() : '';
            calls.push({ url: request.url, body });
            if (url.hostname === 'api.telegram.org') return Response.json({ ok: true });
            if (url.hostname === 'webhook.test') return Response.json({ ok: true });
            if (url.hostname === 'relay.test') return Response.json({ ok: relayOk, version: 'emby-relay-fixture', tls: true, limits: { padding: 'x'.repeat(400) } });
            return new Response('fixture', { status: upstreamOk ? 200 : 503 });
        }
    });
    const origin = 'https://proxy.test';
    const fetch = (path, init = {}) => mf.dispatchFetch(origin + path, { redirect: 'manual', ...init });
    let cookie;
    const post = (path, data, headers = {}) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie || '', ...headers }, body: JSON.stringify(data) });
    const get = path => fetch(path, { headers: { Cookie: cookie || '' } });
    const login = async token => {
        const response = await post('/admin/api/login', { token });
        if (response.ok) cookie = response.headers.get('Set-Cookie').split(';')[0];
        return response;
    };
    try {
        await fetch('/health');
        const db = await mf.getD1Database('DB');
        await t.test('new endpoints require authentication and same-origin JSON', async () => {
            assert.equal((await post('/admin/api/notifications', { clear: true })).status, 401);
            assert.equal((await login(rootPassword)).status, 200);
            assert.equal((await post('/admin/api/notifications', { clear: true }, { Origin: 'https://evil.test' })).status, 403);
            assert.equal((await post('/admin/api/security/password', {}, { Origin: '' })).status, 403);
            assert.equal((await post('/admin/api/login', { token: rootPassword }, { Origin: 'https://evil.test' })).status, 403);
        });
        await t.test('Telegram secrets encrypted at rest and never returned or exported', async () => {
            const response = await post('/admin/api/notifications', { token: botToken, chatId: '-100123456' });
            assert.equal(response.status, 200);
            const status = await response.json();
            assert.equal(status.telegram, true);
            assert.equal(status.source, 'web');
            assert.equal(status.chatId, '-100123456');
            const row = await db.prepare("SELECT value FROM admin_private WHERE key = 'telegram'").first();
            assert.ok(!row.value.includes(botToken));
            assert.ok(!row.value.includes('-100123456'));
            for (const path of ['/admin/api/notifications', '/admin/api/settings', '/admin/api/export']) {
                const res = await get(path);
                assert.equal(res.headers.get('Cache-Control'), 'no-store');
                const text = await res.text();
                assert.ok(!text.includes(botToken));
                assert.ok(!text.includes('ciphertext'));
            }
        });
        await t.test('blank Token preserves saved value; explicit clear suppresses environment fallback', async () => {
            const before = await db.prepare("SELECT value FROM admin_private WHERE key = 'telegram'").first();
            assert.equal((await post('/admin/api/notifications', { token: '', chatId: '-100999' })).status, 200);
            const after = await db.prepare("SELECT value FROM admin_private WHERE key = 'telegram'").first();
            assert.notEqual(JSON.parse(before.value).iv, JSON.parse(after.value).iv);
            calls.length = 0;
            assert.equal((await post('/admin/api/notifications/test', {})).status, 200);
            assert.equal(calls.length, 1);
            assert.ok(calls[0].url.includes(botToken));
            assert.equal(JSON.parse(calls[0].body).chat_id, '-100999');
            assert.equal((await post('/admin/api/notifications', { clear: true })).status, 200);
            calls.length = 0;
            assert.equal((await post('/admin/api/notifications/test', {})).status, 502);
            assert.equal(calls.length, 0);
            assert.equal((await get('/admin/api/notifications').then(r => r.json())).telegram, false);
            await post('/admin/api/notifications', { token: botToken, chatId: '-100123456' });
        });
        await t.test('corrupt encrypted configuration fails closed rather than using legacy credentials', async () => {
            const row = await db.prepare("SELECT value FROM admin_private WHERE key = 'telegram'").first();
            await db.prepare("UPDATE admin_private SET value = 'corrupt' WHERE key = 'telegram'").run();
            calls.length = 0;
            const status = await get('/admin/api/notifications').then(r => r.json());
            assert.equal(status.telegram, false);
            assert.ok(status.error);
            assert.equal((await post('/admin/api/notifications/test', {})).status, 502);
            assert.equal(calls.length, 0);
            await db.prepare("UPDATE admin_private SET value = ? WHERE key = 'telegram'").bind(row.value).run();
        });
        await t.test('unsafe health remarks fall back to private IDs without source, prefix, domain or URL', async () => {
            await db.prepare("INSERT INTO routes (prefix,target,remark,enabled) VALUES (?,?,?,1)").bind('private-path', 'https://secret-upstream.test/secret-path?token=hidden', '<a href="https://remark.test">保密线路</a>').run();
            calls.length = 0;
            const first = await post('/admin/api/health/run', {}).then(r => r.json());
            assert.equal(first.alerts.length, 0);
            const second = await post('/admin/api/health/run', {}).then(r => r.json());
            assert.equal(second.alerts.length, 1);
            assert.match(second.alerts[0], /R-[A-F0-9]{12}/);
            const id = second.alerts[0].match(/R-[A-F0-9]{12}/)[0];
            const routes = await get('/admin/api/routes').then(r => r.json());
            assert.equal(routes.find(r => r.prefix === 'private-path').notification_id, id);
            upstreamOk = true;
            const recovered = await post('/admin/api/health/run', {}).then(r => r.json());
            assert.match(recovered.alerts[0], /线路恢复/);
            assert.ok(recovered.alerts[0].includes(id));
            const notifications = calls.filter(c => /api.telegram.org|webhook.test/.test(c.url));
            assert.equal(notifications.length, 4);
            for (const call of notifications) {
                assert.ok(!/https?:|secret-upstream|secret-path|private-path|remark\.test|hidden|<a|503/.test(call.body));
            }
        });
        await t.test('stored safe remarks identify failures and recoveries in Telegram and Webhook', async () => {
            await db.prepare("UPDATE routes SET remark = ? WHERE prefix = 'private-path'").bind('飞跃 & <影院>').run();
            upstreamOk = false;
            calls.length = 0;
            assert.equal((await post('/admin/api/health/run', {}).then(r => r.json())).alerts.length, 0);
            const down = await post('/admin/api/health/run', {}).then(r => r.json());
            assert.equal(down.alerts[0], '🔴 线路异常：飞跃 &amp; &lt;影院&gt; · 节点 1\n请登录后台查看详情');
            upstreamOk = true;
            const recovered = await post('/admin/api/health/run', {}).then(r => r.json());
            assert.equal(recovered.alerts[0], down.alerts[0].replace('🔴 线路异常', '🟢 线路恢复'));
            const telegram = calls.filter(c => c.url.includes('api.telegram.org')).map(c => JSON.parse(c.body));
            const webhooks = calls.filter(c => c.url.includes('webhook.test')).map(c => JSON.parse(c.body));
            assert.deepEqual(telegram.map(c => c.text), [down.alerts[0], recovered.alerts[0]]);
            assert.deepEqual(webhooks.map(c => c.text), telegram.map(c => c.text));
            assert.ok(telegram.every(c => c.parse_mode === 'HTML' && c.disable_web_page_preview === true));
            assert.ok([...telegram, ...webhooks].every(c => !/secret-upstream|secret-path|private-path|hidden|<a|https?:/.test(c.text)));
        });
        await t.test('credentials copied from the target query into a remark are not sent', async () => {
            await db.prepare("UPDATE routes SET remark = '公益 hidden' WHERE prefix = 'private-path'").run();
            upstreamOk = false;
            calls.length = 0;
            await post('/admin/api/health/run', {});
            const down = await post('/admin/api/health/run', {}).then(r => r.json());
            assert.match(down.alerts[0], /R-[A-F0-9]{12}/);
            assert.ok(calls.filter(c => /api.telegram.org|webhook.test/.test(c.url)).every(c => !c.body.includes('hidden')));
            upstreamOk = true;
            await post('/admin/api/health/run', {});
        });
        await t.test('many long remarks are sent in complete, bounded notification batches', async () => {
            await db.batch(Array.from({ length: 39 }, (_, i) => db.prepare('INSERT INTO routes (prefix,target,remark,enabled) VALUES (?,?,?,1)').bind('batch-' + i, 'https://batch-' + i + '.test', '院&'.repeat(32))));
            try {
                upstreamOk = false;
                calls.length = 0;
                await post('/admin/api/health/run', {});
                const down = await post('/admin/api/health/run', {}).then(r => r.json());
                assert.equal(down.alerts.length, 40);
                const telegram = calls.filter(c => c.url.includes('api.telegram.org')).map(c => JSON.parse(c.body).text);
                const webhooks = calls.filter(c => c.url.includes('webhook.test')).map(c => JSON.parse(c.body).text);
                assert.ok(telegram.length > 1);
                assert.ok(telegram.every(text => text.length <= 4096 && text.endsWith('请登录后台查看详情')));
                assert.equal(telegram.join('\n\n'), down.alerts.join('\n\n'));
                assert.deepEqual(webhooks, telegram);
            } finally {
                await db.batch([db.prepare("DELETE FROM routes WHERE prefix LIKE 'batch-%'"), db.prepare("DELETE FROM route_health WHERE prefix LIKE 'batch-%'")]);
                upstreamOk = true;
                await post('/admin/api/health/run', {});
            }
        });
        await t.test('daily report contains no host or raw analytics error', async () => {
            calls.length = 0;
            const response = await post('/admin/api/report/send', {});
            assert.equal(response.status, 200);
            const out = await response.json();
            assert.ok(!/https?:|proxy\.test|secret-upstream/.test(out.preview));
            assert.match(out.preview, /请登录后台检查统计配置/);
            const status = await get('/admin/api/notifications').then(r => r.json());
            assert.equal(status.last.kind, 'daily');
            assert.equal(status.last.ok, true);
        });
        await t.test('unknown settings and imports cannot overwrite private configuration', async () => {
            const before = await db.prepare("SELECT value FROM admin_private WHERE key = 'telegram'").first();
            await post('/admin/api/settings', { telegram: 'attacker', password: 'attacker', tg_route_alerts: '0' });
            await post('/admin/api/import', { settings: { telegram: 'attacker', password: 'attacker' } });
            const after = await db.prepare("SELECT value FROM admin_private WHERE key = 'telegram'").first();
            assert.equal(after.value, before.value);
            assert.equal(await db.prepare("SELECT value FROM admin_private WHERE key = 'password'").first(), null);
        });
        await t.test('disabled route alerts still update health state but send no notification', async () => {
            upstreamOk = false;
            calls.length = 0;
            await post('/admin/api/health/run', {});
            const second = await post('/admin/api/health/run', {}).then(r => r.json());
            assert.equal(second.alerts.length, 1);
            assert.equal(calls.filter(c => /api.telegram.org|webhook.test/.test(c.url)).length, 0);
        });
        await t.test('password validation: wrong current password and mismatch cannot change credentials', async () => {
            assert.equal((await post('/admin/api/security/password', { currentPassword: 'wrong', newPassword: 'fixture-new-password', confirmPassword: 'fixture-new-password' })).status, 403);
            assert.equal((await post('/admin/api/security/password', { currentPassword: rootPassword, newPassword: 'short', confirmPassword: 'short' })).status, 400);
            assert.equal((await post('/admin/api/security/password', { currentPassword: rootPassword, newPassword: 'fixture-new-password', confirmPassword: 'different' })).status, 400);
            assert.equal((await login(rootPassword)).status, 200);
        });
        await t.test('relay test parses full bounded health JSON and requires body.ok, not merely HTTP 200', async () => {
            await db.prepare("INSERT INTO relay_config (id,relay_url,secret,enabled) VALUES (1,'https://relay.test','fixture-secret','on')").run();
            const healthy = await post('/admin/api/relay/test', {}).then(r => r.json());
            assert.equal(healthy.ok, true);
            assert.equal(healthy.version, 'emby-relay-fixture');
            assert.equal(healthy.tls, true);
            relayOk = false;
            const unhealthy = await post('/admin/api/relay/test', {}).then(r => r.json());
            assert.equal(unhealthy.ok, false);
            assert.ok(unhealthy.error);
        });
        await t.test('password change revokes every old session and rejects the original environment password', async () => {
            const oldCookie = cookie;
            const next = '  fixture-new-password  ';
            const result = await post('/admin/api/security/password', { currentPassword: rootPassword, newPassword: next, confirmPassword: next });
            assert.equal(result.status, 200);
            assert.match(result.headers.get('Set-Cookie'), /Max-Age=0/);
            assert.equal((await get('/admin/api/settings')).status, 401);
            assert.equal((await login(rootPassword)).status, 401);
            assert.equal((await login(next.trim())).status, 401);
            assert.equal((await login(next)).status, 200);
            const record = await db.prepare("SELECT value FROM admin_private WHERE key = 'password'").first();
            assert.ok(!record.value.includes(next));
            assert.ok(!record.value.includes(rootPassword));
            assert.equal(JSON.parse(record.value).iterations, 100000);
            assert.equal((await fetch('/admin/api/settings', { headers: { Cookie: oldCookie } })).status, 401);
            for (const path of ['/admin/api/export', '/admin/api/settings', '/admin/api/security/password', '/admin/api/audit']) {
                const text = await get(path).then(r => r.text());
                assert.ok(!text.includes(next));
                assert.ok(!text.includes(JSON.parse(record.value).hash));
                assert.ok(!text.includes(botToken));
            }
        });
        await t.test('password changes are conditional: concurrent requests cannot both succeed', async () => {
            const change = password => post('/admin/api/security/password', { currentPassword: '  fixture-new-password  ', newPassword: password, confirmPassword: password });
            const responses = await Promise.all([change('fixture-concurrent-password-A'), change('fixture-concurrent-password-B')]);
            assert.equal(responses.filter(r => r.status === 200).length, 1);
            assert.ok(responses.every(r => [200, 401, 403, 409].includes(r.status)));
            const winner = responses[0].status === 200 ? 'fixture-concurrent-password-A' : 'fixture-concurrent-password-B';
            assert.equal((await login(winner)).status, 200);
        });
        await t.test('repeated login failures are throttled', async () => {
            for (let i = 0; i < 5; i++) {
                const result = await post('/admin/api/login', { token: 'wrong' }, { 'cf-connecting-ip': '198.51.100.99' });
                assert.equal(result.status, 401);
            }
            assert.equal((await post('/admin/api/login', { token: rootPassword }, { 'cf-connecting-ip': '198.51.100.99' })).status, 429);
        });
        await t.test('corrupt password state never re-enables the original environment password', async () => {
            await db.prepare("UPDATE admin_private SET value = 'broken' WHERE key = 'password'").run();
            assert.equal((await login(rootPassword)).status, 503);
            assert.equal((await get('/admin/api/settings')).status, 401);
        });
    } finally { await mf.dispose(); }
});
