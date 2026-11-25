// Kept outside settings: never included in settings GET, import or export.
const initialized = new WeakMap();

async function store(env) {
    if (!env.DB) throw new Error('DB 未绑定');
    if (!initialized.has(env.DB)) {
        const ready = env.DB.prepare('CREATE TABLE IF NOT EXISTS admin_private (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
        initialized.set(env.DB, ready);
        ready.catch(() => initialized.delete(env.DB));
    }
    await initialized.get(env.DB);
    return env.DB;
}

export async function getPrivate(env, key) {
    if (!env.DB) return null;
    const db = await store(env);
    const row = await db.prepare('SELECT value FROM admin_private WHERE key = ?').bind(key).first();
    return row ? row.value : null;
}

export async function putPrivate(env, key, value) {
    const db = await store(env);
    await db.prepare('INSERT INTO admin_private (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();
}

// Compare-and-swap prevents concurrent password changes from overwriting each other.
export async function replacePrivate(env, key, previous, value) {
    const db = await store(env);
    const result = previous === null
        ? await db.prepare('INSERT OR IGNORE INTO admin_private (key, value) VALUES (?, ?)').bind(key, value).run()
        : await db.prepare('UPDATE admin_private SET value = ? WHERE key = ? AND value = ?').bind(value, key, previous).run();
    return result.meta?.changes === 1;
}
