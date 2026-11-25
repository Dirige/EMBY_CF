// Additive compatibility for pre-refactor user_routes(user_id, prefix). Never
// rename/drop legacy tables or activate orphaned historical admin_routes rows.
const legacyUserIds = new WeakMap();

async function columns(env, table) {
    const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    return new Set((result.results || []).map(row => row.name));
}

export async function userRoutesHaveLegacyUserId(env) {
    if (!env.DB) return false;
    if (!legacyUserIds.has(env.DB)) {
        const result = columns(env, 'user_routes').then(names => names.has('user_id'));
        legacyUserIds.set(env.DB, result);
        result.catch(() => legacyUserIds.delete(env.DB));
    }
    return legacyUserIds.get(env.DB);
}

export async function ensureLegacyUserRoutes(env) {
    const names = await columns(env, 'user_routes');
    if (!names.has('user_id')) return;
    const additions = [
        ['owner', "TEXT NOT NULL DEFAULT ''"], ['stream_target', "TEXT NOT NULL DEFAULT ''"],
        ['cache_img', "TEXT DEFAULT 'on'"], ['ip_mode', "TEXT DEFAULT 'forward'"],
        ['sort_order', 'INTEGER DEFAULT 0'], ['enabled', 'INTEGER NOT NULL DEFAULT 1'],
        ['custom_headers', "TEXT NOT NULL DEFAULT ''"], ['ip_allow', "TEXT NOT NULL DEFAULT ''"],
        ['ip_block', "TEXT NOT NULL DEFAULT ''"],
    ];
    for (const [name, definition] of additions) {
        if (names.has(name)) continue;
        try { await env.DB.prepare(`ALTER TABLE user_routes ADD COLUMN ${name} ${definition}`).run(); }
        catch (error) {
            // Two isolates can observe the same missing column. Swallow only
            // that race, not an unrelated failed migration.
            if (!(await columns(env, 'user_routes')).has(name)) throw error;
        }
    }
    await env.DB.batch([
        env.DB.prepare(`UPDATE user_routes SET owner = (SELECT username FROM users WHERE users.id = user_routes.user_id)
            WHERE COALESCE(owner, '') = '' AND EXISTS (SELECT 1 FROM users WHERE users.id = user_routes.user_id AND username <> '')`),
        env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_legacy_user_routes_owner_prefix ON user_routes(owner, prefix) WHERE owner <> ''"),
    ]);
}
