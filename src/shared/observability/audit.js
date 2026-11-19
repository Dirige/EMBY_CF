// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.


async function auditLog(env2, action, detail) {
    if (!env2.DB)
        return;
    try {
        await env2.DB.prepare("INSERT INTO audit_log (ts, action, detail) VALUES (?, ?, ?)").bind(( /* @__PURE__ */new Date()).toISOString(), action, String(detail || "").slice(0, 500)).run();
        if (Math.random() < 0.05) {
            await env2.DB.prepare("DELETE FROM audit_log WHERE id <= (SELECT MAX(id) - 500 FROM audit_log)").run();
        }
    }
    catch (_) {
    }
}

export { auditLog };
