import { getTelegramToken, getTelegramChatId } from '../../../shared/auth/session.js';
import { sendTelegramMessage } from '../../../shared/integrations/analytics.js';
import { getPrivate, putPrivate } from './private-store.js';

const enc = new TextEncoder();
const aad = enc.encode('emby-multi:telegram:v1');
const toBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));

async function encryptionKey(env, source = null) {
    const configured = String(env.SETTINGS_ENCRYPTION_KEY || '');
    if (source === 'settings' || source === null && configured) {
        try {
            const bytes = fromBase64(configured);
            return bytes.length === 32 ? { bytes, source: 'settings' } : null;
        } catch { return null; }
    }
    if (source && source !== 'session') return null;
    // Purpose-separated derivation keeps existing fd bindings untouched. An
    // explicit dedicated key is supported; changing the root needs re-saving TG.
    const root = String(env.SESSION_SECRET || '');
    if (enc.encode(root).length < 32) return null;
    const key = await crypto.subtle.importKey('raw', enc.encode(root), 'HKDF', false, ['deriveBits']);
    const bytes = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256',
        salt: enc.encode('emby-multi:private-config:v1'), info: aad }, key, 256));
    return { bytes, source: 'session' };
}

export async function encryptTelegram(env, config) {
    const master = await encryptionKey(env);
    if (!master) throw new Error('需要 32 字节 Base64 SETTINGS_ENCRYPTION_KEY 或至少 32 字节的 SESSION_SECRET');
    const key = await crypto.subtle.importKey('raw', master.bytes, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, enc.encode(JSON.stringify(config)));
    return JSON.stringify({ v: 1, keySource: master.source, iv: toBase64(iv), ciphertext: toBase64(ciphertext) });
}

export async function getTelegramConfig(env) {
    const saved = await getPrivate(env, 'telegram');
    if (saved === null) return { token: getTelegramToken(env), chatId: getTelegramChatId(env), source: 'environment' };
    if (saved === 'disabled') return { token: '', chatId: '', source: 'disabled' };
    try {
        const data = JSON.parse(saved);
        if (data.v !== 1 || !['settings', 'session'].includes(data.keySource)) throw new Error();
        const master = await encryptionKey(env, data.keySource);
        if (!master) throw new Error();
        const key = await crypto.subtle.importKey('raw', master.bytes, 'AES-GCM', false, ['decrypt']);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(data.iv), additionalData: aad }, key, fromBase64(data.ciphertext));
        const config = JSON.parse(new TextDecoder().decode(plain));
        if (typeof config.token !== 'string' || typeof config.chatId !== 'string') throw new Error();
        return { ...config, source: 'web' };
    } catch {
        return { token: '', chatId: '', source: 'web', error: '通知配置无法解密，请检查主密钥或重新保存配置' };
    }
}

export async function notificationStatus(env) {
    const config = await getTelegramConfig(env);
    let last = null;
    try { last = JSON.parse(await getPrivate(env, 'notification_last') || 'null'); } catch {}
    return { telegram: Boolean(config.token && config.chatId), webhook: Boolean(env.NOTIFY_WEBHOOK),
        tokenConfigured: Boolean(config.token), chatId: config.chatId, source: config.source,
        error: config.error || '', encryptionReady: Boolean(await encryptionKey(env)), last };
}

export async function saveTelegramConfig(env, data) {
    if (data.clear === true) { await putPrivate(env, 'telegram', 'disabled'); return; }
    const previous = await getTelegramConfig(env);
    const token = String(data.token || '').trim() || previous.token;
    const chatId = String(data.chatId ?? '').trim();
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(token) || token.length > 256) throw new Error('Bot Token 格式不正确');
    if (!/^-?\d{1,20}$/.test(chatId)) throw new Error('Chat ID 必须是数字');
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
    const result = await sendTelegramMessage(await notificationEnv(env), '✅ Emby Proxy 多人版通知测试成功（不包含线路地址）');
    await recordNotification(env, 'test', result.ok);
    return { ok: result.ok, error: result.ok ? '' : '测试发送失败，请检查机器人、Chat ID 和发送权限' };
}
