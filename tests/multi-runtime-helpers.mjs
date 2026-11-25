import { build } from 'esbuild';
import { Miniflare, Log, LogLevel } from 'miniflare';
import { pbkdf2Sync, createHmac } from 'node:crypto';
import { root, textAssets } from '../scripts/build.mjs';

let compiled;
export async function multiScript() {
    compiled ||= build({ entryPoints: [`${root}/src/multi.js`], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false, plugins: [textAssets] });
    return (await compiled).outputFiles[0].text;
}

export const rootPassword = 'synthetic-original-admin-password';
export const sessionRoot = 'synthetic-session-root-at-least-32-bytes-long';
export const origin = 'https://proxy.test';
export const passwordRecord = (password, salt = '00112233445566778899aabbccddeeff') => ({
    salt, hash: pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex'),
});
export const legacyCookie = (uid, twoParts = false) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const message = twoParts ? 'session:' + exp : 'session:' + uid + ':' + exp;
    return 'admin_session=' + (twoParts ? exp : uid + '.' + exp) + '.' + createHmac('sha256', sessionRoot).update(message).digest('hex');
};

export async function multiRuntime({ bindings = {}, outbound = () => new Response('synthetic unavailable', { status: 503 }), peers = false, initialize = true } = {}) {
    const options = {
        modules: true, script: await multiScript(), compatibilityDate: '2026-10-17', compatibilityFlags: [],
        bindings: { ADMIN_TOKEN: rootPassword, SESSION_SECRET: sessionRoot, BASE_DOMAIN: 'example.test', USER_DOMAIN: 'example.test', DNS_RECORD_NAME: 'proxy', DISABLE_DIRECT_PROXY: '1', ...bindings },
        d1Databases: { DB: 'multi-synthetic-runtime' }, outboundService: outbound,
    };
    const mf = new Miniflare({ host: '127.0.0.1', port: 0, log: new Log(LogLevel.ERROR), workers: [{ name: 'default', ...options }, ...(peers ? [{ name: 'peer', ...options }] : [])] });
    const fetch = (path, init = {}) => mf.dispatchFetch(origin + path, { redirect: 'manual', ...init });
    const get = (path, cookie = '') => fetch(path, { headers: { Cookie: cookie } });
    const post = (path, data, cookie = '', headers = {}) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie, ...headers }, body: JSON.stringify(data) });
    let db;
    try {
        if (initialize) await fetch('/health');
        db = await mf.getD1Database('DB');
    } catch (error) { await mf.dispose(); throw error; }
    const login = async (username = 'admin', password = rootPassword) => {
        const response = await post('/admin/api/login', { username, password });
        return { response, cookie: response.headers.get('Set-Cookie')?.split(';')[0] || '' };
    };
    const seedUser = async (username, id, role = 'user', password = 'synthetic-user-password') => {
        const { hash, salt } = passwordRecord(password);
        await db.prepare('INSERT INTO users (id,username,password_hash,salt,role,status,subdomain,route_limit) VALUES (?,?,?,?,?,\'active\',?,20)').bind(id, username, hash, salt, role, username).run();
    };
    return { mf, db, fetch, get, post, login, seedUser };
}
