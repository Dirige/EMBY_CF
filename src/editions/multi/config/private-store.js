// Never included in settings GET/import/export. Existing users and secrets stay
// in place; an optional per-user epoch revokes sessions only on password change.
const initialized = new WeakMap();

export async function privateStore(env) {
    if (!env.DB) throw new Error('DB 未绑定');
    if (!initialized.has(env.DB)) {
        const ready = env.DB.batch([
            env.DB.prepare('CREATE TABLE IF NOT EXISTS multi_private (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
            env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS multi_password_session_epoch
                AFTER UPDATE OF password_hash, salt ON users
                WHEN NEW.password_hash IS NOT OLD.password_hash OR NEW.salt IS NOT OLD.salt
                BEGIN
                    INSERT INTO multi_private (key, value) VALUES ('user_epoch:' || NEW.id, lower(hex(randomblob(32))))
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value;
                END`),
        ]);
        initialized.set(env.DB, ready);
        ready.catch(() => initialized.delete(env.DB));
    }
    await initialized.get(env.DB);
    return env.DB;
}

export async function getPrivate(env, key) {
    if (!env.DB) return null;
    const db = await privateStore(env);
    const row = await db.prepare('SELECT value FROM multi_private WHERE key = ?').bind(key).first();
    return row ? row.value : null;
}

export async function putPrivate(env, key, value) {
    const db = await privateStore(env);
    await db.prepare('INSERT INTO multi_private (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();
}

export async function replacePrivate(env, key, previous, value) {
    const db = await privateStore(env);
    const result = previous === null
        ? await db.prepare('INSERT OR IGNORE INTO multi_private (key, value) VALUES (?, ?)').bind(key, value).run()
        : await db.prepare('UPDATE multi_private SET value = ? WHERE key = ? AND value = ?').bind(value, key, previous).run();
    return result.meta?.changes === 1;
}
