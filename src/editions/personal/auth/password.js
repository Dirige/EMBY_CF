import { getAdminToken, toHex } from '../../../shared/auth/session.js';
import { getPrivate, replacePrivate } from '../config/private-store.js';

const enc = new TextEncoder();
const ITERATIONS = 100000; // Workers Web Crypto limit; input is additionally peppered by ADMIN_TOKEN.

export async function keyedHash(secret, text) {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

function equal(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

export async function credentialState(env) {
    const raw = await getPrivate(env, 'password');
    if (raw === null) return { raw, record: null };
    const record = JSON.parse(raw);
    if (record.v !== 1 || record.iterations !== ITERATIONS || !/^[a-f0-9]{32}$/.test(record.salt) || !/^[a-f0-9]{64}$/.test(record.hash) || !/^[a-f0-9]{64}$/.test(record.epoch)) throw new Error('登录配置无效，请在 Cloudflare 侧重置');
    return { raw, record };
}

async function passwordHash(env, password, salt) {
    const pepper = getAdminToken(env);
    if (!pepper) throw new Error('Worker 未配置 ADMIN_TOKEN');
    const input = await keyedHash(pepper, 'password:' + password);
    const key = await crypto.subtle.importKey('raw', enc.encode(input), 'PBKDF2', false, ['deriveBits']);
    return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS }, key, 256));
}

export async function verifyPassword(env, password, state = null) {
    const secret = getAdminToken(env);
    if (!secret || typeof password !== 'string' || password.length > 1024) return false;
    state ||= await credentialState(env);
    if (!state.record) return equal(await keyedHash(secret, 'compare:' + password.trim()), await keyedHash(secret, 'compare:' + secret));
    return equal(await passwordHash(env, password, state.record.salt), state.record.hash);
}

export async function sessionSecret(env, state = null) {
    const root = getAdminToken(env);
    if (!root) return null;
    state ||= await credentialState(env);
    return state.record ? keyedHash(root, 'session-epoch:' + state.record.epoch) : root;
}

export async function changePassword(env, currentPassword, newPassword) {
    if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128) return { ok: false, status: 400, error: '新密码须为 12–128 个字符' };
    const state = await credentialState(env);
    if (!await verifyPassword(env, currentPassword, state)) return { ok: false, status: 403, error: '当前密码错误' };
    if (currentPassword === newPassword) return { ok: false, status: 400, error: '新密码不能与当前密码相同' };
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const record = { v: 1, iterations: ITERATIONS, salt, hash: await passwordHash(env, newPassword, salt), epoch: toHex(crypto.getRandomValues(new Uint8Array(32))) };
    const ok = await replacePrivate(env, 'password', state.raw, JSON.stringify(record));
    return ok ? { ok: true } : { ok: false, status: 409, error: '密码已被其他操作更新，请重新登录' };
}
