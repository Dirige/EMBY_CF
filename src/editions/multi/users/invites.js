// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { makeInviteCode } from "./../auth/session.js";
import { auditLog } from "./../../../shared/observability/audit.js";

async function adminListInvites(env2) {
    const { results } = await env2.DB.prepare("SELECT * FROM invite_codes ORDER BY created_at DESC, code").all();
    return (results || []).map((r) => ({
        code: r.code,
        maxUses: Number(r.max_uses) || 0,
        usedCount: Number(r.used_count) || 0,
        expiresAt: r.expires_at || "",
        note: r.note || "",
        createdBy: r.created_by || "",
        createdAt: r.created_at || ""
    }));
}

async function adminCreateInvite(env2, data, actor) {
    const code = String(data.code || "").trim().toUpperCase() || makeInviteCode();
    if (!/^[A-Z0-9-]{4,32}$/.test(code))
        return { error: "\u9080\u8BF7\u7801\u4EC5\u5141\u8BB8 4-32 \u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u77ED\u6A2A\u7EBF" };
    const maxUses = Math.max(0, Math.min(1e4, parseInt(data.max_uses, 10) || 1));
    const expiresAt = String(data.expires_at || "").trim();
    if (expiresAt && isNaN(new Date(expiresAt).getTime()))
        return { error: "\u8FC7\u671F\u65F6\u95F4\u683C\u5F0F\u4E0D\u6B63\u786E" };
    const note = String(data.note || "").slice(0, 200);
    try {
        await env2.DB.prepare("INSERT INTO invite_codes (code, max_uses, used_count, expires_at, note, created_by, created_at) VALUES (?, ?, 0, ?, ?, ?, ?)").bind(code, maxUses, expiresAt, note, actor, ( /* @__PURE__ */new Date()).toISOString()).run();
        await auditLog(env2, "invite.create", actor + " -> " + code);
        return { invite: { code, maxUses, usedCount: 0, expiresAt, note, createdBy: actor } };
    }
    catch (e) {
        const msg = String(e?.message || e || "");
        return { error: /UNIQUE/i.test(msg) ? "\u9080\u8BF7\u7801\u5DF2\u5B58\u5728" : "\u521B\u5EFA\u5931\u8D25: " + msg };
    }
}

async function adminClearInvites(env2, actor) {
    let deleted = 0;
    try {
        const row = await env2.DB.prepare("SELECT COUNT(*) AS n FROM invite_codes").first();
        deleted = Number(row?.n) || 0;
    }
    catch (_) {
    }
    const res = await env2.DB.prepare("DELETE FROM invite_codes").run();
    if (Number(res.meta?.changes) > 0)
        deleted = Number(res.meta.changes);
    await auditLog(env2, "invite.clear", actor + " -> " + deleted);
    return { ok: true, deleted };
}

async function adminDeleteInvite(env2, code, actor) {
    const raw = String(code || "").trim();
    const upper = raw.toUpperCase();
    if (!raw)
        return { error: "\u9080\u8BF7\u7801\u4E0D\u80FD\u4E3A\u7A7A" };
    let row = await env2.DB.prepare("SELECT code FROM invite_codes WHERE code = ? OR code = ? LIMIT 1").bind(raw, upper).first();
    if (!row)
        row = await env2.DB.prepare("SELECT code FROM invite_codes WHERE UPPER(code) = ? LIMIT 1").bind(upper).first();
    if (!row)
        return { ok: true, alreadyDeleted: true };
    const res = await env2.DB.prepare("DELETE FROM invite_codes WHERE code = ?").bind(row.code).run();
    if (!res.meta?.changes)
        return { error: "\u5220\u9664\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5" };
    await auditLog(env2, "invite.delete", actor + " -> " + row.code);
    return { ok: true };
}

export { adminListInvites, adminCreateInvite, adminClearInvites, adminDeleteInvite };
