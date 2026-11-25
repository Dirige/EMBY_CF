// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { getTelegramChatId, getTelegramToken } from "./../auth/session.js";
import { isValidHttpUrl } from "./../http/validation.js";

async function notify(env2, text) {
    const jobs = [];
    const tgToken = getTelegramToken(env2);
    const tgChat = getTelegramChatId(env2);
    if (tgToken && tgChat) {
        jobs.push(fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: tgChat, text: String(text).slice(0, 4096), parse_mode: "HTML", disable_web_page_preview: true }),
            signal: AbortSignal.timeout(15000)
        }).then(async res => res.ok && (await res.json().catch(() => ({}))).ok === true).catch(() => false));
    }
    if (env2.NOTIFY_WEBHOOK && isValidHttpUrl(env2.NOTIFY_WEBHOOK)) {
        jobs.push(fetch(env2.NOTIFY_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, content: text }),
            signal: AbortSignal.timeout(15000)
        }).then(res => res.ok).catch(() => false));
    }
    const results = await Promise.all(jobs);
    return { ok: results.some(Boolean) };
}

export { notify };
