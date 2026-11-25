import { getTelegramToken, getTelegramChatId } from '../../../shared/auth/session.js';
import { sendTelegramMessage } from '../../../shared/integrations/analytics.js';
import { getPrivate, putPrivate } from './private-store.js';

const enc = new TextEncoder();
const aad = enc.encode('emby-personal:telegram:v1');
const toBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));

function keyBytes(env) {
    try {
        const key = fromBase64(String(env.SETTINGS_ENCRYPTION_KEY || ''));
        return key.length === 32 ? key : null;
    } catch { return null; }
}

export async function encryptTelegram(env, config) {
    const bytes = keyBytes(env);
    if (!bytes) throw new Error('请先在 Worker Secret 配置 SETTINGS_ENCRYPTION_KEY（32 字节随机值的 Base64）');
    const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, enc.encode(JSON.stringify(config)));
    return JSON.stringify({ v: 1, iv: toBase64(iv), ciphertext: toBase64(ciphertext) });
}

export async function getTelegramConfig(env) {
    const saved = await getPrivate(env, 'telegram');
    if (saved === null) return { token: getTelegramToken(env), chatId: getTelegramChatId(env), source: 'environment' };
    if (saved === 'disabled') return { token: '', chatId: '', source: 'disabled' };
    try {
        const data = JSON.parse(saved);
        const bytes = keyBytes(env);
        if (data.v !== 1 || !bytes) throw new Error();
        const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(data.iv), additionalData: aad }, key, fromBase64(data.ciphertext));
        const config = JSON.parse(new TextDecoder().decode(plain));
        if (typeof config.token !== 'string' || typeof config.chatId !== 'string') throw new Error();
        return { ...config, source: 'web' };
    } catch {
        // Never silently fall back to a different bot/chat when decryption fails.
        return { token: '', chatId: '', source: 'web', error: '通知配置无法解密，请检查加密主密钥或重新保存配置' };
    }
}

export async function notificationStatus(env) {
    const config = await getTelegramConfig(env);
    return {
        telegram: Boolean(config.token && config.chatId), webhook: Boolean(env.NOTIFY_WEBHOOK),
        tokenConfigured: Boolean(config.token), chatId: config.chatId,
        source: config.source, error: config.error || '', encryptionReady: Boolean(keyBytes(env)),
        last: JSON.parse(await getPrivate(env, 'notification_last') || 'null')
    };
}

export async function saveTelegramConfig(env, data) {
    if (data.clear === true) {
        await putPrivate(env, 'telegram', 'disabled');
        return;
    }
    const previous = await getTelegramConfig(env);
    const token = String(data.token || '').trim() || previous.token;
    const chatId = String(data.chatId ?? '').trim();
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(token) || token.length > 256) throw new Error('Bot Token 格式不正确');
    if (!/^-?\d{1,20}$/.test(chatId)) throw new Error('Chat ID 必须是数字（群组可为负数）');
    await putPrivate(env, 'telegram', await encryptTelegram(env, { token, chatId }));
}

export async function notificationEnv(env) {
    const config = await getTelegramConfig(env);
    return { ...env, TELEGRAM_BOT_TOKEN: config.token, TELEGRAM_CHAT_ID: config.chatId, TG_BOT_TOKEN: '', TG_CHAT_ID: '' };
}

export async function recordNotification(env, kind, ok) {
    await putPrivate(env, 'notification_last', JSON.stringify({ kind, ok: Boolean(ok), at: new Date().toISOString() }));
}

export async function testTelegram(env) {
    const result = await sendTelegramMessage(await notificationEnv(env), '✅ Emby Proxy 通知测试成功（不包含线路地址）');
    await recordNotification(env, 'test', result.ok);
    return { ok: result.ok, error: result.ok ? '' : '测试发送失败，请检查机器人、Chat ID 和发送权限' };
}
