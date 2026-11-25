import { getAdminToken } from '../../../shared/auth/session.js';
import { keyedHash } from '../auth/password.js';

const remarkCharacters = /^[\p{L}\p{M}\p{N}\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator} _\-·—–()[\]{}<>!&'",，、“”‘’「」【】《》〈〉~+|]+$/u;
const credentialWords = /(?:\b(?:token|secret|password|passwd|authorization|bearer|credential|signature|sig|jwt|key|api[-_ ]?key|access[-_ ]?token)\b|密码|口令|密钥|令牌|签名|凭据)/iu;
const opaqueCredentials = /[a-z\d_-]{24,}|[a-f\d]{16,}|\d{9,}/i;
const normalizeRemark = text => text.normalize('NFKC').replace(/\s+/gu, ' ').replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
const escapeTelegramHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function safeRouteRemark(remark, privateValues = []) {
    if (typeof remark !== 'string' || remark.length > 512) return '';
    const name = normalizeRemark(remark);
    // Fail closed rather than guessing which part of a mixed name/URL is public.
    // The allowlist excludes URL, hostname, path, query and HTML-entity punctuation.
    if (!name || [...name].length > 64 || !remarkCharacters.test(name) || credentialWords.test(name) || opaqueCredentials.test(name)) return '';
    const canonical = name.toLowerCase();
    if (privateValues.some(value => {
        if (typeof value !== 'string' || !value) return false;
        const secret = normalizeRemark(value).toLowerCase();
        return secret && (canonical === secret || (secret.length >= 4 && canonical.includes(secret)));
    })) return '';
    return name;
}

export async function notificationId(env, prefix) {
    const secret = getAdminToken(env);
    // The fallback never reveals the route prefix or its source address.
    if (!secret) return 'R-UNKNOWN';
    return 'R-' + (await keyedHash(secret, 'notification-route:' + prefix)).slice(0, 12).toUpperCase();
}

export async function privateHealthAlert(env, prefix, index, down, { remark = '', targets = [] } = {}) {
    const privateValues = Object.entries(env)
        .filter(([key, value]) => typeof value === 'string' && /token|secret|password|key/i.test(key))
        .map(([, value]) => value);
    for (const target of targets) {
        try {
            const url = new URL(target);
            privateValues.push(url.hostname, url.pathname, ...url.searchParams.values());
            privateValues.push(decodeURIComponent(url.username), decodeURIComponent(url.password));
        } catch { /* Invalid targets never become notification labels. */ }
    }
    const name = safeRouteRemark(remark, privateValues);
    const label = name ? escapeTelegramHtml(name) : await notificationId(env, prefix);
    return `${down ? '🔴 线路异常' : '🟢 线路恢复'}：${label} · 节点 ${index + 1}\n请登录后台查看详情`;
}

export function healthAlertMessages(alerts) {
    const messages = [];
    let current = '';
    for (const alert of alerts) {
        const next = current ? current + '\n\n' + alert : alert;
        if (next.length > 4096 && current) {
            messages.push(current);
            current = alert;
        } else current = next;
    }
    if (current) messages.push(current);
    return messages;
}
