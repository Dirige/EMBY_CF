// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { DEFAULT_OPTIMIZED_DOMAINS } from "./../../../shared/http/primitives.js";
import { ensureLegacyUserRoutes } from './legacy.js';

var DEFAULT_USER_ROUTE_LIMIT = 20;

var DEFAULT_USER_DNS_TARGET = "youxuan.cf.090227.xyz";

var USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

var RESERVED_PREFIXES = /* @__PURE__ */ new Set([
    "admin",
    "api",
    "stats",
    "health",
    "register",
    "login",
    "logout",
    "favicon.ico",
    "robots.txt",
    "cdn-cgi",
    ".well-known",
    "assets",
    "static"
]);

var RESERVED_SUBDOMAINS = /* @__PURE__ */ new Set([
    "admin",
    "api",
    "www",
    "mail",
    "smtp",
    "ftp",
    "ns",
    "ns1",
    "ns2",
    "dns",
    "proxy",
    "stats",
    "health",
    "register",
    "login",
    "logout",
    "cdn",
    "static",
    "test",
    "dev",
    "staging",
    "root",
    "support",
    "help",
    "status"
]);

var UPSTREAM_FAILOVER_STATUSES = Object.freeze([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);

var CF_ORIGIN_ERROR_STATUSES = Object.freeze([520, 521, 522, 523, 524, 525, 526, 527, 530]);

var dbReady = false;

var dbInitPromise = null;

async function initDatabase(env2) {
    if (!env2.DB || dbReady)
        return;
    if (!dbInitPromise) {
        dbInitPromise = (async () => {
            await initDatabaseSchema(env2);
            dbReady = true;
        })();
    }
    try {
        await dbInitPromise;
    }
    catch (_) {
        dbInitPromise = null;
        dbReady = false;
    }
}

var SCHEMA_ID = "multi-v6.8.5";

async function initDatabaseSchema(env2) {
    try {
        const marker = await env2.DB.prepare(`SELECT value FROM settings WHERE key = 'schema_init'`).first();
        if (marker && marker.value === SCHEMA_ID) {
            await ensureLegacyUserRoutes(env2);
            return;
        }
    }
    catch (_) {
    }
    await env2.DB.batch([
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS routes (
      prefix TEXT PRIMARY KEY, target TEXT NOT NULL,
      stream_target TEXT DEFAULT '',
      remark TEXT DEFAULT '', last_play TEXT DEFAULT '',
      cache_img TEXT DEFAULT 'on', compat_mode TEXT DEFAULT 'off',
      ip_mode TEXT DEFAULT 'forward',
      sort_order INTEGER DEFAULT 0,
      created_by TEXT NOT NULL DEFAULT ''
    )`),
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS optimized_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_builtin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`),
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS dns_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dns_name TEXT NOT NULL,
      current_domain TEXT,
      zone_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`),
        // 新增：小时级聚合统计（参考 CF-EMBY-PROXY-UI proxy_stats_hourly）
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS proxy_stats_hourly (
      bucket_date TEXT NOT NULL,
      bucket_hour INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      play_count INTEGER NOT NULL DEFAULT 0,
      playback_info_count INTEGER NOT NULL DEFAULT 0,
      traffic_bytes INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (bucket_date, bucket_hour)
    )`),
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`),
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS route_health (
      prefix TEXT NOT NULL, target TEXT NOT NULL,
      down INTEGER NOT NULL DEFAULT 0, fail_count INTEGER NOT NULL DEFAULT 0,
      latency INTEGER NOT NULL DEFAULT -1, last_check TEXT, last_change TEXT,
      PRIMARY KEY (prefix, target)
    )`),
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS route_stats_daily (
      prefix TEXT NOT NULL, bucket_date TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0, traffic_bytes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (prefix, bucket_date)
    )`),
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT ''
    )`),
        // ===== 多人版 =====
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      subdomain TEXT NOT NULL DEFAULT '',
      route_limit INTEGER NOT NULL DEFAULT 20,
      created_at TEXT NOT NULL DEFAULT '',
      last_login TEXT NOT NULL DEFAULT ''
    )`),
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    )`),
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS user_routes (
      owner TEXT NOT NULL,
      prefix TEXT NOT NULL,
      target TEXT NOT NULL,
      stream_target TEXT NOT NULL DEFAULT '',
      remark TEXT DEFAULT '',
      last_play TEXT DEFAULT '',
      cache_img TEXT DEFAULT 'on',
      compat_mode TEXT DEFAULT 'off',
      ip_mode TEXT DEFAULT 'forward',
      sort_order INTEGER DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      custom_headers TEXT NOT NULL DEFAULT '',
      ip_allow TEXT NOT NULL DEFAULT '',
      ip_block TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (owner, prefix)
    )`),
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS user_stats_hourly (
      owner TEXT NOT NULL,
      bucket_date TEXT NOT NULL,
      bucket_hour INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      play_count INTEGER NOT NULL DEFAULT 0,
      playback_info_count INTEGER NOT NULL DEFAULT 0,
      traffic_bytes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (owner, bucket_date, bucket_hour)
    )`)
    ]);
    try {
        await env2.DB.prepare(`ALTER TABLE routes ADD COLUMN ip_mode TEXT DEFAULT 'forward'`).run();
    }
    catch (e) {
    }
    try {
        await env2.DB.prepare(`ALTER TABLE routes ADD COLUMN stream_target TEXT NOT NULL DEFAULT ''`).run();
    }
    catch (e) {
    }
    try {
        await env2.DB.prepare(`ALTER TABLE user_routes ADD COLUMN stream_target TEXT NOT NULL DEFAULT ''`).run();
    }
    catch (e) {
    }
    try {
        await env2.DB.prepare(`ALTER TABLE users ADD COLUMN subdomain TEXT NOT NULL DEFAULT ''`).run();
    }
    catch (e) {
    }
    try {
        await env2.DB.prepare(`ALTER TABLE users ADD COLUMN route_limit INTEGER NOT NULL DEFAULT 20`).run();
    }
    catch (e) {
    }
    try {
        await env2.DB.prepare(`ALTER TABLE users ADD COLUMN last_login TEXT NOT NULL DEFAULT ''`).run();
    }
    catch (e) {
    }
    try {
        await env2.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_subdomain ON users(subdomain) WHERE subdomain <> ''`).run();
    }
    catch (e) {
    }
    for (const col of [
        `max_uses INTEGER NOT NULL DEFAULT 1`,
        `used_count INTEGER NOT NULL DEFAULT 0`,
        `expires_at TEXT NOT NULL DEFAULT ''`,
        `note TEXT NOT NULL DEFAULT ''`,
        `created_by TEXT NOT NULL DEFAULT ''`,
        `created_at TEXT NOT NULL DEFAULT ''`
    ]) {
        try {
            await env2.DB.prepare(`ALTER TABLE invite_codes ADD COLUMN ${col}`).run();
        }
        catch (e) {
        }
    }
    await ensureLegacyUserRoutes(env2);
    try {
        await env2.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_routes_owner ON user_routes(owner)`).run();
    }
    catch (e) {
    }
    try {
        await env2.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_stats_owner ON user_stats_hourly(owner, bucket_date)`).run();
    }
    catch (e) {
    }
    for (const col of [
        `enabled INTEGER NOT NULL DEFAULT 1`,
        `custom_headers TEXT NOT NULL DEFAULT ''`,
        `ip_allow TEXT NOT NULL DEFAULT ''`,
        `ip_block TEXT NOT NULL DEFAULT ''`,
        // 路由归属：记录是哪个管理员添加的。老数据为空字符串，视为「历史路由」，
        // 仍在代理链路里生效，但不会出现在任何管理员的「我的路由」里。
        `created_by TEXT NOT NULL DEFAULT ''`
    ]) {
        try {
            await env2.DB.prepare(`ALTER TABLE routes ADD COLUMN ${col}`).run();
        }
        catch (e) {
        }
    }
    try {
        await env2.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by)`).run();
    }
    catch (e) {
    }
    try {
        let hasUserId = false;
        try {
            await env2.DB.prepare("SELECT user_id FROM routes LIMIT 1").first();
            hasUserId = true;
        }
        catch (_) {
        }
        if (hasUserId) {
            const done = await env2.DB.prepare("SELECT value FROM settings WHERE key = 'route_owner_from_user_id_v1'").first();
            if (!done) {
                await env2.DB.prepare(`UPDATE routes
              SET created_by = COALESCE((SELECT username FROM users WHERE users.id = routes.user_id), '')
            WHERE user_id IS NOT NULL AND user_id <> '' AND CAST(user_id AS INTEGER) > 0`).run();
                await env2.DB.prepare("INSERT INTO settings (key, value) VALUES ('route_owner_from_user_id_v1', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();
            }
        }
    }
    catch (e) {
    }
    // Existing preferred domains are user configuration, even if they once
    // shipped as defaults. Schema initialization must not delete them.
    try {
        await env2.DB.prepare(`ALTER TABLE proxy_stats_hourly ADD COLUMN traffic_bytes INTEGER NOT NULL DEFAULT 0`).run();
    }
    catch (e) {
    }
    try {
        await env2.DB.prepare(`ALTER TABLE proxy_stats_hourly ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0`).run();
    }
    catch (e) {
    }
    try {
        await env2.DB.prepare(`ALTER TABLE proxy_stats_hourly ADD COLUMN playback_info_count INTEGER NOT NULL DEFAULT 0`).run();
    }
    catch (e) {
    }
    try {
        const { results } = await env2.DB.prepare("SELECT COUNT(*) as count FROM optimized_domains").all();
        if (results[0].count === 0) {
            const stmt = env2.DB.prepare("INSERT INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 1)");
            for (const d of DEFAULT_OPTIMIZED_DOMAINS) {
                try {
                    await stmt.bind(d.domain, d.name).run();
                }
                catch (e) {
                }
            }
        }
    }
    catch (e) {
    }
    try {
        await env2.DB.prepare(`INSERT INTO settings (key, value) VALUES ('schema_init', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(SCHEMA_ID).run();
    }
    catch (_) {
    }
}

export { DEFAULT_USER_ROUTE_LIMIT, DEFAULT_USER_DNS_TARGET, USERNAME_RE, RESERVED_PREFIXES, RESERVED_SUBDOMAINS, UPSTREAM_FAILOVER_STATUSES, CF_ORIGIN_ERROR_STATUSES, dbReady, dbInitPromise, initDatabase, SCHEMA_ID, initDatabaseSchema };
