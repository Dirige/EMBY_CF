import test from 'node:test';
import assert from 'node:assert/strict';
import * as personal from '../src/editions/personal/integrations/alert-privacy.js';
import * as multi from '../src/editions/multi/integrations/alert-privacy.js';

for (const [edition, { healthAlertMessages, notificationId, privateHealthAlert, safeRouteRemark }] of [['personal', personal], ['multi', multi]]) {

const env = { ADMIN_TOKEN: 'fixture-root', CF_API_TOKEN: 'fixture-cf-private', SETTINGS_ENCRYPTION_KEY: 'fixture-encryption-private' };
const prefix = 'private-route-prefix';

test(`${edition} health labels: ordinary Chinese, ASCII and emoji remarks stay recognizable`, () => {
    for (const remark of ['飞跃', 'fy', 'Orange - Blue 2', '公益（备用）', '🇭🇰 香港 · 节点 A', '影院 & <音乐>']) {
        assert.equal(safeRouteRemark(remark), remark.normalize('NFKC'));
    }
    assert.equal(safeRouteRemark('  飞跃\n  备用\u200b  '), '飞跃 备用');
    assert.equal(safeRouteRemark('名'.repeat(64)), '名'.repeat(64));
});

test(`${edition} health labels: links, hosts, paths, credentials and obfuscated addresses fail closed`, () => {
    const remarks = [
        '飞跃 https://source.test/private?token=hidden', 'source.test', 'source。test', 'source．test', 'source｡test',
        '192.0.2.1', '[2001:db8::1]', 'localhost:8096', 'user@source.test', '/private-path', 'folder\\private',
        'https%3A%2F%2Fsource%2Etest', 'source&#46;test', 'source&period;test', 'secret\u200b.test',
        '<a href="https://source.test">飞跃</a>', '<b>飞跃</b>', '<img src=x onerror=alert(1)>',
        'token hidden', 'API_KEY hidden', 'Bearer hidden', '密码 hidden', '签名 hidden',
        '0123456789abcdef0123456789abcdef', '0123456789abcdef', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345', 'cfut_fixture_private_token',
        '名'.repeat(65), '名'.repeat(64) + ' https://hidden.test', '', ' \n\u200b', null, 123, {}
    ];
    for (const remark of remarks) assert.equal(safeRouteRemark(remark), '', `unsafe fixture: ${String(remark)}`);
});

test(`${edition} health labels: known private values are withheld even when they look like short names`, async () => {
    const targets = ['https://user:pass@source.test/private?api_key=hidden&mode=1'];
    for (const remark of ['公益 hidden', 'user', 'pass', 'fixture-root', '公益 fixture-cf-private', 'fixture-encryption-private']) {
        const text = await privateHealthAlert(env, prefix, 0, true, { remark, targets });
        assert.ok(text.includes(await notificationId(env, prefix)));
        assert.ok(!text.includes(remark));
    }
    assert.match(await privateHealthAlert(env, prefix, 0, true, { remark: '公益 1', targets }), /公益 1/);
});

test(`${edition} health labels: Telegram HTML is escaped and the same remark identifies failure and recovery`, async () => {
    const remark = '飞跃 & <影院>';
    const down = await privateHealthAlert(env, prefix, 1, true, { remark });
    const recovered = await privateHealthAlert(env, prefix, 1, false, { remark });
    assert.equal(down, '🔴 线路异常：飞跃 &amp; &lt;影院&gt; · 节点 2\n请登录后台查看详情');
    assert.equal(recovered, '🟢 线路恢复：飞跃 &amp; &lt;影院&gt; · 节点 2\n请登录后台查看详情');
    assert.ok(!down.includes(prefix));
    assert.ok(!/<[^>]*>/.test(down));
});

test(`${edition} health labels: missing or unsafe remarks retain stable, private fallback identifiers`, async () => {
    const id = await notificationId(env, prefix);
    assert.match(id, /^R-[A-F0-9]{12}$/);
    assert.notEqual(await notificationId(env, 'other-prefix'), id);
    for (const remark of ['', 'source.test']) {
        const down = await privateHealthAlert(env, prefix, 0, true, { remark });
        const recovered = await privateHealthAlert(env, prefix, 0, false, { remark });
        assert.ok(down.includes(id));
        assert.ok(recovered.includes(id));
    }
    assert.match(await privateHealthAlert({}, prefix, 0, true), /R-UNKNOWN/);
});

test(`${edition} health alerts: long batches stay within Telegram limits without cutting a label or entity`, async () => {
    const alerts = await Promise.all(Array.from({ length: 40 }, (_, i) => privateHealthAlert(env, prefix + i, 0, true, { remark: '院&'.repeat(32) })));
    const messages = healthAlertMessages(alerts);
    assert.ok(messages.length > 1);
    assert.ok(messages.every(text => text.length <= 4096));
    assert.equal(messages.join('\n\n'), alerts.join('\n\n'));
    assert.ok(messages.every(text => text.endsWith('请登录后台查看详情')));
    assert.deepEqual(healthAlertMessages([]), []);
});
}

test('multi health labels: user names are private and route identifiers are tenant/edition scoped', async () => {
    const env = { ADMIN_TOKEN: 'synthetic-root' };
    const id = await multi.notificationId(env, 'alice/demo');
    assert.notEqual(await multi.notificationId(env, 'bob/demo'), id);
    assert.notEqual(await personal.notificationId(env, 'alice/demo'), id);
    assert.ok((await multi.privateHealthAlert(env, 'alice/demo', 0, true, { owner: 'alice', remark: 'alice' })).includes(id));
});
