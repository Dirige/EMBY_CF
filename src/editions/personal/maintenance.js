// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { splitTargets } from "./../../shared/admin/api.js";
import { probeTarget } from "./../../shared/http/validation.js";
import { notify } from "./../../shared/integrations/notifications.js";
import { initDatabase } from "./storage/schema.js";
import { getSettings } from "./config/settings.js";
import { getShanghaiParts } from "./../../shared/http/primitives.js";
import { claimReportSlot } from "./../../shared/integrations/analytics.js";
import { sendDailyReport } from "./integrations/analytics.js";
import { healthAlertMessages, privateHealthAlert } from './integrations/alert-privacy.js';
import { notificationEnv, recordNotification } from './config/notifications.js';

async function runHealthCheck(env2, manual = false) {
    if (!env2.DB)
        return { checked: 0, alerts: [] };
    const { results: routes } = await env2.DB.prepare("SELECT prefix, target, remark FROM routes WHERE enabled != 0").all();
    const { results: states } = await env2.DB.prepare("SELECT * FROM route_health").all();
    const stateMap = new Map((states || []).map((r) => [r.prefix + "|" + r.target, r]));
    const jobs = [];
    for (const r of routes || []) {
        for (const [index, t] of splitTargets(r.target).entries())
            jobs.push({ r, t, index });
    }
    const limited = jobs.slice(0, 40);
    const probes = await Promise.all(limited.map(async (j) => ({ ...j, res: await probeTarget(j.t) })));
    const nowIso = ( /* @__PURE__ */new Date()).toISOString();
    const stmts = [];
    const alerts = [];
    for (const { r, t, index, res } of probes) {
        const prev = stateMap.get(r.prefix + "|" + t);
        const fail = res.ok ? 0 : (prev?.fail_count || 0) + 1;
        const down = res.ok ? 0 : fail >= 2 ? 1 : prev?.down || 0;
        const changed = (prev?.down || 0) !== down;
        if (changed)
            alerts.push(await privateHealthAlert(env2, r.prefix, index, down, { remark: r.remark, targets: splitTargets(r.target) }));
        stmts.push(env2.DB.prepare(`INSERT INTO route_health (prefix, target, down, fail_count, latency, last_check, last_change) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(prefix, target) DO UPDATE SET down = excluded.down, fail_count = excluded.fail_count, latency = excluded.latency,
         last_check = excluded.last_check, last_change = CASE WHEN route_health.down != excluded.down THEN excluded.last_check ELSE route_health.last_change END`).bind(r.prefix, t, down, fail, res.ms, nowIso, nowIso));
    }
    if (stmts.length)
        await env2.DB.batch(stmts);
    const settings = await getSettings(env2);
    if (alerts.length && String(settings.raw.tg_route_alerts ?? '1') !== '0') {
        const effectiveEnv = await notificationEnv(env2);
        let ok = true;
        // Split only between alerts, never inside an escaped remark or HTML entity.
        for (const text of healthAlertMessages(alerts)) {
            const result = await notify(effectiveEnv, text);
            ok = result.ok && ok;
        }
        await recordNotification(env2, 'health', ok);
    }
    return { checked: probes.length, alerts };
}

async function runScheduled(env2) {
    if (!env2.DB)
        return;
    await initDatabase(env2);
    const st = await getSettings(env2);
    if (st.healthCheck) {
        try {
            await runHealthCheck(env2);
        }
        catch (_) {
        }
    }
    const now = getShanghaiParts();
    const reportEnabled = String(st.raw.tg_daily_report ?? "1") !== "0";
    if (reportEnabled && now.hour === 23) {
        try {
            if (await claimReportSlot(env2, now.dateKey))
                await sendDailyReport(env2, now.dateKey);
        }
        catch (_) {
        }
    }
}

export { runHealthCheck, runScheduled };
