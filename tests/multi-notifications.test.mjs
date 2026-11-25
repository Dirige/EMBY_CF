import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptTelegram, getTelegramConfig, notificationStatus, saveTelegramConfig } from '../src/editions/multi/config/notifications.js';
import { encryptTelegram as encryptPersonal } from '../src/editions/personal/config/notifications.js';

function privateFixture(bindings = {}) {
    const values = new Map();
    const env = { SESSION_SECRET: 'synthetic-session-root-at-least-32-bytes-long', TELEGRAM_BOT_TOKEN: '555555:legacy-token', TELEGRAM_CHAT_ID: '55555', ...bindings };
    env.DB = {
        async batch() { return []; },
        prepare(sql) {
            return { args: [], bind(...args) { this.args = args; return this; },
                async first() { return values.has(this.args[0]) ? { value: values.get(this.args[0]) } : null; },
                async run() { if (sql.startsWith('INSERT INTO multi_private')) values.set(this.args[0], this.args[1]); return { meta: { changes: 1 } }; },
            };
        },
    };
    return { env, values };
}

for (const source of ['session', 'settings']) test(`multi Telegram crypto: ${source} key is purpose-separated, randomized and non-exportable`, async () => {
    const { env, values } = privateFixture(source === 'settings' ? { SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 21).toString('base64') } : {});
    const config = { token: '123456:synthetic-token', chatId: '-100123456' };
    const first = await encryptTelegram(env, config), second = await encryptTelegram(env, config);
    assert.notEqual(first, second);
    assert.equal(JSON.parse(first).keySource, source);
    assert.ok(!first.includes(config.token) && !first.includes(config.chatId));
    values.set('telegram', first);
    assert.deepEqual(await getTelegramConfig(env), { ...config, source: 'web' });
    const status = await notificationStatus(env);
    assert.equal(status.telegram, true); assert.equal(status.encryptionReady, true);
    assert.ok(!JSON.stringify(status).includes(config.token));
    const other = { ...env, SESSION_SECRET: 'different-synthetic-root-at-least-32-bytes-long', SETTINGS_ENCRYPTION_KEY: source === 'settings' ? Buffer.alloc(32, 22).toString('base64') : undefined };
    assert.equal((await getTelegramConfig(other)).telegram, undefined);
    assert.equal((await getTelegramConfig(other)).token, '');
    values.set('telegram', await encryptPersonal({ SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 21).toString('base64') }, config));
    assert.equal((await getTelegramConfig(env)).token, '');
});

test('multi Telegram crypto: weak session roots and malformed explicit keys cannot silently fall back', async () => {
    for (const bindings of [{ SESSION_SECRET: 'too-short' }, { SETTINGS_ENCRYPTION_KEY: 'invalid' }]) {
        const { env } = privateFixture(bindings);
        assert.equal((await notificationStatus(env)).encryptionReady, false);
        await assert.rejects(saveTelegramConfig(env, { token: '123456:synthetic-token', chatId: '-100' }));
        assert.equal((await getTelegramConfig(env)).source, 'environment');
    }
});

test('multi Telegram crypto: adding a dedicated key does not orphan a saved session-derived configuration', async () => {
    const { env, values } = privateFixture();
    await saveTelegramConfig(env, { token: '123456:synthetic-token', chatId: '-100' });
    const upgraded = { ...env, SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 23).toString('base64') };
    assert.equal((await getTelegramConfig(upgraded)).token, '123456:synthetic-token');
    await saveTelegramConfig(upgraded, { token: '', chatId: '-101' });
    assert.equal(JSON.parse(values.get('telegram')).keySource, 'settings');
    assert.equal((await getTelegramConfig(upgraded)).chatId, '-101');
});

test('multi Telegram crypto: explicit clear or tampered ciphertext never re-enables environment credentials', async () => {
    const { env, values } = privateFixture();
    await saveTelegramConfig(env, { clear: true });
    assert.deepEqual(await getTelegramConfig(env), { token: '', chatId: '', source: 'disabled' });
    await saveTelegramConfig(env, { token: '123456:synthetic-token', chatId: '-100' });
    const data = JSON.parse(values.get('telegram'));
    data.ciphertext = Buffer.alloc(32).toString('base64'); values.set('telegram', JSON.stringify(data));
    const config = await getTelegramConfig(env);
    assert.equal(config.token, ''); assert.ok(config.error);
});
