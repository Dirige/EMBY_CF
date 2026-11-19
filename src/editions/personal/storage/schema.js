// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { DEFAULT_OPTIMIZED_DOMAINS } from "./../../../shared/http/primitives.js";

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

var SCHEMA_ID = "proxy-v6.4.8";

async function initDatabaseSchema(env2) {
    try {
        const marker = await env2.DB.prepare(`SELECT value FROM settings WHERE key = 'schema_init'`).first();
        if (marker && marker.value === SCHEMA_ID)
            return;
    }
    catch (_) {
    }
    await env2.DB.batch([
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS routes (
      prefix TEXT PRIMARY KEY, target TEXT NOT NULL,
      remark TEXT DEFAULT '', last_play TEXT DEFAULT '',
      cache_img TEXT DEFAULT 'on', compat_mode TEXT DEFAULT 'off',
      ip_mode TEXT DEFAULT 'forward',
      sort_order INTEGER DEFAULT 0
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
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`),
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS route_health (
      prefix TEXT NOT NULL, target TEXT NOT NULL,
      down INTEGER NOT NULL DEFAULT 0, fail_count INTEGER NOT NULL DEFAULT 0,
      latency INTEGER NOT NULL DEFAULT -1, last_check TEXT, last_change TEXT,
      PRIMARY KEY (prefix, target)
    )`),
        env2.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT ''
    )`)
    ]);
    try {
        await env2.DB.prepare(`ALTER TABLE routes ADD COLUMN ip_mode TEXT DEFAULT 'forward'`).run();
    }
    catch (e) {
    }
    for (const col of [
        `enabled INTEGER NOT NULL DEFAULT 1`,
        `custom_headers TEXT NOT NULL DEFAULT ''`,
        `ip_allow TEXT NOT NULL DEFAULT ''`,
        `ip_block TEXT NOT NULL DEFAULT ''`,
        `use_relay TEXT NOT NULL DEFAULT 'off'`
    ]) {
        try {
            await env2.DB.prepare(`ALTER TABLE routes ADD COLUMN ${col}`).run();
        }
        catch (e) {
        }
    }
    try {
        await env2.DB.prepare(`CREATE TABLE IF NOT EXISTS relay_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      relay_url TEXT DEFAULT '',
      secret TEXT DEFAULT '',
      cert_pem TEXT DEFAULT '',
      key_pem TEXT DEFAULT '',
      enabled TEXT DEFAULT 'off',
      updated_at TEXT DEFAULT ''
    )`).run();
    }
    catch (e) {
    }
    try {
        await env2.DB.prepare(`DELETE FROM optimized_domains WHERE domain = 'www.visa.cn' AND is_builtin = 1`).run();
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

export { dbReady, dbInitPromise, initDatabase, SCHEMA_ID, initDatabaseSchema };
