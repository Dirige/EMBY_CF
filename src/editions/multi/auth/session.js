// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { LOGIN_MAX_FAILS, LOGIN_WINDOW_MS, SESSION_COOKIE, envStr, getAdminToken, getCookie, getDnsRecordName, logoutResponse, toHex } from "./../../../shared/auth/session.js";
import { clearOwnerCache } from "./../proxy/routes.js";
import { json } from "./../../../shared/http/responses.js";
import { readJson } from "./../../../shared/admin/api.js";
import { DEFAULT_USER_ROUTE_LIMIT, RESERVED_SUBDOMAINS, USERNAME_RE } from "./../storage/schema.js";
import { auditLog } from "./../../../shared/observability/audit.js";
import { provisionUserDns } from "./../users/dns.js";
import { getStatsHost } from "./../integrations/zone.js";
import { credentialState, verifyAdminPassword, changeAdminPassword } from './password.js';
import { getPrivate, privateStore } from '../config/private-store.js';

var SESSION_TTL_SEC = 7 * 24 * 3600;

var ADMIN_UID = 0;

var enc = new TextEncoder();

function hexToBytes(hex) {
    const h = String(hex || "");
    const out = new Uint8Array(Math.floor(h.length / 2));
    for (let i = 0; i < out.length; i++)
        out[i] = parseInt(h.substr(i * 2, 2), 16) || 0;
    return out;
}

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

async function sessionSecret(env2, uid = ADMIN_UID, epoch = undefined) {
    const root = envStr(env2, "SESSION_SECRET") || getAdminToken(env2) || "";
    if (!root) return '';
    if (epoch === undefined) {
        epoch = uid === ADMIN_UID ? (await credentialState(env2)).record?.epoch ?? null
            : await getPrivate(env2, 'user_epoch:' + uid);
    }
    if (epoch === null) return root;
    if (!/^[a-f0-9]{64}$/.test(epoch)) throw new Error('会话配置无效');
    return hmacHex(root, 'multi-session:' + uid + ':epoch:' + epoch);
}

async function userCredentialState(env2, field, value) {
    await privateStore(env2);
    // Read credentials and their epoch in one SQLite snapshot. A cached old
    // password must never mint a token using a newer password's signing key.
    return env2.DB.prepare(`SELECT u.*, (SELECT value FROM multi_private WHERE key = 'user_epoch:' || u.id) AS _session_epoch
        FROM users u WHERE ${field === 'id' ? 'id' : 'username'} = ?`).bind(value).first();
}

async function makeSessionToken(secret, uid = ADMIN_UID) {
    const exp = Math.floor(Date.now() / 1e3) + SESSION_TTL_SEC;
    const id = Number(uid) || 0;
    return id + "." + exp + "." + await hmacHex(secret, "session:" + id + ":" + exp);
}

async function verifySessionToken(token, secret) {
    const parts = String(token || "").split(".");
    const now = Math.floor(Date.now() / 1e3);
    if (parts.length === 2) {
        const exp2 = parseInt(parts[0], 10);
        if (!parts[1] || !Number.isFinite(exp2) || exp2 < now)
            return null;
        if (!await safeEqual(parts[1], await hmacHex(secret, "session:" + exp2), secret))
            return null;
        return { uid: ADMIN_UID, exp: exp2 };
    }
    if (parts.length !== 3)
        return null;
    const uid = parseInt(parts[0], 10);
    const exp = parseInt(parts[1], 10);
    if (!Number.isFinite(uid) || uid < 0 || !Number.isFinite(exp) || exp < now)
        return null;
    if (!await safeEqual(parts[2], await hmacHex(secret, "session:" + uid + ":" + exp), secret))
        return null;
    return { uid, exp };
}

function randomHex(bytes = 16) {
    const buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    return toHex(buf);
}

async function hashPassword(password, saltHex) {
    const key = await crypto.subtle.importKey("raw", enc.encode(String(password || "")), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: hexToBytes(saltHex), iterations: 1e5, hash: "SHA-256" }, key, 256);
    return toHex(bits);
}

async function verifyPassword(password, saltHex, expectedHex) {
    try {
        const got = await hashPassword(password, saltHex);
        return safeEqual(got, expectedHex, "pw-cmp");
    }
    catch (_) {
        return false;
    }
}

var userCache = /* @__PURE__ */ new Map();

function clearUserCache() {
    userCache.clear();
    try {
        clearOwnerCache();
    }
    catch (_) {
    }
}

function rowToUser(r) {
    if (!r)
        return null;
    return {
        id: Number(r.id),
        username: r.username,
        passwordHash: r.password_hash,
        salt: r.salt,
        role: r.role || "user",
        status: r.status || "active",
        subdomain: r.subdomain || "",
        routeLimit: Number(r.route_limit) || 20,
        createdAt: r.created_at || "",
        lastLogin: r.last_login || ""
    };
}

function publicUser(u) {
    if (!u)
        return null;
    return {
        id: u.id,
        username: u.username,
        role: u.role,
        status: u.status,
        subdomain: u.subdomain || "",
        routeLimit: u.routeLimit || 20,
        createdAt: u.createdAt || "",
        lastLogin: u.lastLogin || ""
    };
}

async function getUserById(env2, id) {
    if (!env2.DB || !Number.isFinite(Number(id)))
        return null;
    const key = "id:" + id;
    const now = Date.now();
    const hit = userCache.get(key);
    if (hit && hit.exp > now)
        return hit.user;
    const row = await env2.DB.prepare("SELECT * FROM users WHERE id = ?").bind(Number(id)).first();
    const user = rowToUser(row);
    userCache.set(key, { user, exp: now + 15e3 });
    if (userCache.size > 500)
        userCache.clear();
    return user;
}

async function getUserByUsername(env2, username) {
    if (!env2.DB || !username)
        return null;
    const uname = String(username).toLowerCase();
    const key = "name:" + uname;
    const now = Date.now();
    const hit = userCache.get(key);
    if (hit && hit.exp > now)
        return hit.user;
    const row = await env2.DB.prepare("SELECT * FROM users WHERE username = ?").bind(uname).first();
    const user = rowToUser(row);
    userCache.set(key, { user, exp: now + 15e3 });
    if (userCache.size > 500)
        userCache.clear();
    return user;
}

async function getSession(request, env2) {
    const tok = getCookie(request, SESSION_COOKIE);
    if (!tok)
        return null;
    const parts = tok.split('.');
    const uid = parts.length === 2 ? ADMIN_UID : parts.length === 3 && /^\d+$/.test(parts[0]) ? Number(parts[0]) : -1;
    if (!Number.isSafeInteger(uid) || uid < 0) return null;
    let secret, user;
    try {
        if (uid === ADMIN_UID) secret = await sessionSecret(env2, uid);
        else {
            const row = await userCredentialState(env2, 'id', uid);
            user = rowToUser(row);
            if (!user || user.status !== 'active') return null;
            secret = await sessionSecret(env2, uid, row._session_epoch ?? null);
        }
    } catch { return null; }
    if (!secret) return null;
    const v = await verifySessionToken(tok, secret);
    if (!v)
        return null;
    if (v.uid === ADMIN_UID) {
        return { uid: 0, id: 0, username: "admin", role: "admin", status: "active", subdomain: "", isAdmin: true, exp: v.exp };
    }
    return {
        uid: user.id,
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
        subdomain: user.subdomain,
        isAdmin: user.role === "admin",
        exp: v.exp
    };
}

async function isAdmin(request, env2) {
    const s = await getSession(request, env2);
    return Boolean(s && s.isAdmin);
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
        while (loginFails.size > 5e3) loginFails.delete(loginFails.keys().next().value);
    }
}

function sessionCookie(token, maxAge = SESSION_TTL_SEC) {
    return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict; Secure`;
}

async function loginJson(env2, uid, username, isAdminUser, extra = {}, validatedSecret = null) {
    const token = await makeSessionToken(validatedSecret ?? await sessionSecret(env2, uid), uid);
    return new Response(JSON.stringify({ ok: true, user: { uid, username, isAdmin: Boolean(isAdminUser) }, ...extra }), {
        status: 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Set-Cookie": sessionCookie(token),
            "Cache-Control": "no-store"
        }
    });
}

async function adminLoginResponse(request, env2, creds = {}) {
    const secret = envStr(env2, 'SESSION_SECRET') || getAdminToken(env2) || '';
    if (!secret) {
        return json({
            ok: false,
            error: "Worker \u672A\u8BFB\u5230 ADMIN_TOKEN / SESSION_SECRET\u3002\u8BF7\u5728 Cloudflare \u63A7\u5236\u53F0 \u2192 Worker \u2192 \u8BBE\u7F6E \u2192 \u53D8\u91CF\u548C\u673A\u5BC6 \u4E2D\u6DFB\u52A0\u3002"
        }, 503);
    }
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (loginBlocked(ip))
        return json({ ok: false, error: "\u5C1D\u8BD5\u6B21\u6570\u8FC7\u591A\uFF0C\u8BF7 10 \u5206\u949F\u540E\u518D\u8BD5" }, 429);
    const username = String(creds.username || "").trim().toLowerCase();
    const password = String(creds.password != null ? creds.password : creds.token || "");
    if (password.length > 1024 || username.length > 32) return json({ ok: false, error: '登录信息过长' }, 400);
    if (!password)
        return json({ ok: false, error: "\u8BF7\u8F93\u5165\u5BC6\u7801 / \u7BA1\u7406\u5BC6\u94A5" }, 400);
    if (!username || username === "admin") {
        const expected = getAdminToken(env2);
        let valid, state;
        try {
            state = await credentialState(env2);
            valid = expected && await verifyAdminPassword(env2, password, state);
        }
        catch { return json({ ok: false, error: '登录配置暂不可用，请检查数据库或管理员恢复流程' }, 503); }
        if (!valid) {
            loginFailed(ip);
            return json({ ok: false, error: "\u7BA1\u7406\u5BC6\u94A5\u9519\u8BEF" }, 401);
        }
        loginFails.delete(ip);
        return loginJson(env2, ADMIN_UID, 'admin', true, {}, await sessionSecret(env2, ADMIN_UID, state.record?.epoch ?? null));
    }
    const row = await userCredentialState(env2, 'username', username);
    const user = rowToUser(row);
    if (!user || user.status !== "active" || !await verifyPassword(password, user.salt, user.passwordHash)) {
        loginFailed(ip);
        return json({ ok: false, error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
    }
    const validatedSecret = await sessionSecret(env2, user.id, row._session_epoch ?? null);
    loginFails.delete(ip);
    try {
        await env2.DB.prepare("UPDATE users SET last_login = ? WHERE id = ?").bind(( /* @__PURE__ */new Date()).toISOString(), user.id).run();
        clearUserCache();
    }
    catch (_) {
    }
    return loginJson(env2, user.id, user.username, user.role === 'admin', {}, validatedSecret);
}

function makeInviteCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    const rnd = crypto.getRandomValues(new Uint8Array(10));
    for (let i = 0; i < 10; i++)
        s += alphabet[rnd[i] % alphabet.length];
    return s;
}

async function handleRegister(request, env2) {
    if (!env2.DB)
        return json({ ok: false, error: "D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
    const secret = envStr(env2, 'SESSION_SECRET') || getAdminToken(env2) || '';
    if (!secret)
        return json({ ok: false, error: "\u672A\u914D\u7F6E ADMIN_TOKEN / SESSION_SECRET" }, 503);
    const data = await readJson(request) || {};
    const username = sanitizeUsername(data.username);
    const password = String(data.password || "");
    const code = String(data.invite || data.code || "").trim();
    const requestedSub = username;
    if (!username)
        return json({ ok: false, error: "\u7528\u6237\u540D\u9700\u4E3A 3-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u6216\u77ED\u6A2A\u7EBF\uFF0C\u4E14\u4E0D\u80FD\u4EE5\u77ED\u6A2A\u7EBF\u5F00\u5934/\u7ED3\u5C3E" }, 400);
    if (password.length < 6)
        return json({ ok: false, error: "\u5BC6\u7801\u81F3\u5C11 6 \u4F4D" }, 400);
    if (!code)
        return json({ ok: false, error: "\u8BF7\u8F93\u5165\u9080\u8BF7\u7801" }, 400);
    if (!requestedSub)
        return json({ ok: false, error: "\u7528\u6237\u540D\u4E0D\u80FD\u4F5C\u4E3A\u5B50\u57DF\u540D\uFF0C\u8BF7\u66F4\u6362" }, 400);
    const entryErr = entryNameError(env2, requestedSub);
    if (entryErr)
        return json({ ok: false, error: entryErr }, 400);
    const invite = await env2.DB.prepare("SELECT * FROM invite_codes WHERE code = ? OR UPPER(code) = ? LIMIT 1").bind(code, code.toUpperCase()).first();
    if (!invite)
        return json({ ok: false, error: "\u9080\u8BF7\u7801\u65E0\u6548" }, 403);
    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
        return json({ ok: false, error: "\u9080\u8BF7\u7801\u5DF2\u8FC7\u671F" }, 403);
    }
    if (Number(invite.max_uses) > 0 && Number(invite.used_count) >= Number(invite.max_uses)) {
        return json({ ok: false, error: "\u9080\u8BF7\u7801\u4F7F\u7528\u6B21\u6570\u5DF2\u7528\u5B8C" }, 403);
    }
    const exists = await env2.DB.prepare("SELECT 1 AS x FROM users WHERE username = ? OR (subdomain <> '' AND subdomain = ?)").bind(username, requestedSub).first();
    if (exists)
        return json({ ok: false, error: "\u7528\u6237\u540D\u6216\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" }, 409);
    const salt = randomHex(16);
    const hash = await hashPassword(password, salt);
    const nowIso = ( /* @__PURE__ */new Date()).toISOString();
    let batchOut = null;
    try {
        batchOut = await env2.DB.batch([
            env2.DB.prepare("INSERT INTO users (username, password_hash, salt, role, status, subdomain, route_limit, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(username, hash, salt, "user", "active", requestedSub, DEFAULT_USER_ROUTE_LIMIT, nowIso, nowIso),
            env2.DB.prepare("UPDATE invite_codes SET used_count = used_count + 1 WHERE code = ? AND (max_uses = 0 OR used_count < max_uses)").bind(invite.code)
        ]);
    }
    catch (e) {
        return json({ ok: false, error: /UNIQUE/i.test(String(e?.message)) ? "\u7528\u6237\u540D\u6216\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" : "\u6CE8\u518C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" }, 409);
    }
    const usedNow = batchOut && batchOut[1] && batchOut[1].meta ? Number(batchOut[1].meta.changes) : 0;
    if (!usedNow) {
        try {
            await env2.DB.prepare("DELETE FROM users WHERE username = ?").bind(username).run();
        }
        catch (_) {
        }
        clearUserCache();
        return json({ ok: false, error: "\u9080\u8BF7\u7801\u4F7F\u7528\u6B21\u6570\u5DF2\u7528\u5B8C" }, 403);
    }
    clearUserCache();
    const user = await getUserByUsername(env2, username);
    if (!user)
        return json({ ok: false, error: "\u6CE8\u518C\u6210\u529F\u4F46\u8BFB\u53D6\u7528\u6237\u5931\u8D25" }, 500);
    await auditLog(env2, "user.register", username + " / " + requestedSub);
    const dns = await provisionUserDns(env2, user);
    return loginJson(env2, user.id, user.username, user.role === "admin", dns.ok ? { dns: { entryHost: dns.entryHost, target: dns.target, type: dns.type } } : { dnsWarning: dns.error });
}

function sanitizeUsername(v) {
    const s = String(v || "").trim().toLowerCase();
    return USERNAME_RE.test(s) ? s : "";
}

function sanitizeSubdomain(v) {
    const s = String(v || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(s))
        return "";
    return s;
}

function entryNameError(env2, name) {
    const s = String(name || "").trim().toLowerCase();
    if (!s)
        return "\u5B50\u57DF\u540D\u4E0D\u5408\u6CD5";
    if (RESERVED_SUBDOMAINS.has(s))
        return "\u8BE5\u7528\u6237\u540D\u5DF2\u88AB\u7CFB\u7EDF\u4FDD\u7559\uFF0C\u8BF7\u66F4\u6362";
    const dns = getDnsRecordName(env2);
    if (dns && s === dns)
        return "\u8BE5\u7528\u6237\u540D\u4E0E Worker \u4E3B\u5165\u53E3\u91CD\u540D\uFF0C\u8BF7\u66F4\u6362";
    if (getStatsHost(env2) && s === getStatsHost(env2))
        return "\u8BE5\u7528\u6237\u540D\u4E0E\u7EDF\u8BA1\u5165\u53E3\u91CD\u540D\uFF0C\u8BF7\u66F4\u6362";
    return "";
}

async function changePassword(request, env2, session) {
    if (!session) return json({ ok: false, error: 'Unauthorized' }, 401);
    if (request.headers.get('Origin') !== new URL(request.url).origin || !request.headers.get('Content-Type')?.startsWith('application/json')) {
        return json({ ok: false, error: '必须使用同源 JSON 请求' }, 403);
    }
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (loginBlocked(ip)) return json({ ok: false, error: '尝试次数过多，请 10 分钟后再试' }, 429);
    const data = await readJson(request) || {};
    const oldPassword = String(data.currentPassword ?? data.oldPassword ?? data.old ?? '');
    const newPassword = String(data.newPassword || data.new || "");
    if (newPassword.length < 12 || newPassword.length > 128 || oldPassword.length > 1024) return json({ ok: false, error: '新密码须为 12–128 个字符' }, 400);
    if (data.confirmPassword !== undefined && data.confirmPassword !== newPassword) return json({ ok: false, error: '两次新密码不一致' }, 400);
    if (oldPassword === newPassword) return json({ ok: false, error: '新密码不能与当前密码相同' }, 400);
    if (session.uid === ADMIN_UID) {
        let out;
        try { out = await changeAdminPassword(env2, oldPassword, newPassword); }
        catch { return json({ ok: false, error: '登录配置暂不可用，请检查数据库' }, 503); }
        if (!out.ok) {
            if (out.status === 403) loginFailed(ip);
            return json({ ok: false, error: out.error }, out.status);
        }
        loginFails.delete(ip);
        await auditLog(env2, 'security.password', 'built-in admin changed; sessions revoked');
        return logoutResponse();
    }
    const user = rowToUser(await userCredentialState(env2, 'id', session.uid));
    if (!user || !await verifyPassword(oldPassword, user.salt, user.passwordHash)) {
        loginFailed(ip);
        return json({ ok: false, error: '当前密码错误' }, 403);
    }
    const salt = randomHex(16);
    const hash = await hashPassword(newPassword, salt);
    await privateStore(env2);
    // D1 meta.changes also counts the epoch trigger's write. RETURNING identifies
    // the actual conditional update instead of treating a successful change as
    // a conflict because the trigger changed a second row.
    const result = await env2.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ? AND password_hash = ? AND salt = ? RETURNING id')
        .bind(hash, salt, user.id, user.passwordHash, user.salt).first();
    clearUserCache();
    if (!result || Number(result.id) !== user.id) return json({ ok: false, error: '密码已被其他操作更新，请重新登录' }, 409);
    loginFails.delete(ip);
    await auditLog(env2, 'user.password', user.username + '; sessions revoked');
    return logoutResponse();
}

export { SESSION_TTL_SEC, ADMIN_UID, enc, hexToBytes, hmacHex, safeEqual, sessionSecret, makeSessionToken, verifySessionToken, randomHex, hashPassword, verifyPassword, userCache, clearUserCache, rowToUser, publicUser, getUserById, getUserByUsername, getSession, isAdmin, loginFails, loginBlocked, loginFailed, sessionCookie, loginJson, adminLoginResponse, makeInviteCode, handleRegister, sanitizeUsername, sanitizeSubdomain, entryNameError, changePassword };
