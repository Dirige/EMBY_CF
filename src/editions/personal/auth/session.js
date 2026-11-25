// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { LOGIN_MAX_FAILS, LOGIN_WINDOW_MS, SESSION_COOKIE, getAdminToken, getCookie, toHex } from "./../../../shared/auth/session.js";
import { json } from "./../../../shared/http/responses.js";
import { credentialState, sessionSecret, verifyPassword } from './password.js';

var SESSION_TTL_SEC = 7200;

var enc = new TextEncoder();

async function hmacHex(secret, msg) {
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

async function safeEqual(a, b, secret) {
    const [x, y] = await Promise.all([hmacHex(secret, "cmp:" + a), hmacHex(secret, "cmp:" + b)]);
    let d = 0;
    for (let i = 0; i < x.length; i++)
        d |= x.charCodeAt(i) ^ y.charCodeAt(i);
    return d === 0;
}

async function makeSessionToken(secret) {
    const exp = Math.floor(Date.now() / 1e3) + SESSION_TTL_SEC;
    return exp + "." + await hmacHex(secret, "session:" + exp);
}

async function isAdmin(request, env2) {
    const tok = getCookie(request, SESSION_COOKIE);
    if (!tok)
        return false;
    let secret;
    try { secret = await sessionSecret(env2); } catch { return false; }
    if (!secret) return false;
    const [expStr, sig] = tok.split(".");
    const exp = parseInt(expStr, 10);
    if (!sig || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1e3))
        return false;
    return safeEqual(sig, await hmacHex(secret, "session:" + exp), secret);
}

var loginFails = /* @__PURE__ */ new Map();

function loginBlocked(ip) {
    const rec = loginFails.get(ip);
    if (!rec)
        return false;
    if (Date.now() - rec.first > LOGIN_WINDOW_MS) {
        loginFails.delete(ip);
        return false;
    }
    return rec.n >= LOGIN_MAX_FAILS;
}

function loginFailed(ip) {
    const now = Date.now();
    const rec = loginFails.get(ip);
    if (!rec || now - rec.first > LOGIN_WINDOW_MS)
        loginFails.set(ip, { n: 1, first: now });
    else
        rec.n++;
    if (loginFails.size > 5e3) {
        for (const [k, v] of loginFails)
            if (now - v.first > LOGIN_WINDOW_MS)
                loginFails.delete(k);
    }
}

async function adminLoginResponse(request, env2, tokenFromUser) {
    const expected = getAdminToken(env2);
    if (!expected) {
        return json({
            ok: false,
            error: "Worker 未读到 ADMIN_TOKEN。请在 Cloudflare 控制台 → Worker → 设置 → 变量和机密 中添加 ADMIN_TOKEN。"
        }, 503);
    }
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (loginBlocked(ip))
        return json({ ok: false, error: "尝试次数过多，请 10 分钟后再试" }, 429);
    let state;
    try { state = await credentialState(env2); }
    catch { return json({ ok: false, error: '登录配置暂不可用，请检查数据库或执行管理员恢复流程' }, 503); }
    if (!await verifyPassword(env2, tokenFromUser, state)) {
        loginFailed(ip);
        return json({ ok: false, error: "密钥错误" }, 401);
    }
    loginFails.delete(ip);
    const cookie = `${SESSION_COOKIE}=${encodeURIComponent(await makeSessionToken(await sessionSecret(env2, state)))}; Path=/; Max-Age=${SESSION_TTL_SEC}; HttpOnly; SameSite=Strict; Secure`;
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Set-Cookie": cookie,
            "Cache-Control": "no-store"
        }
    });
}

export { SESSION_TTL_SEC, enc, hmacHex, safeEqual, makeSessionToken, isAdmin, loginFails, loginBlocked, loginFailed, adminLoginResponse };
