import { normalizePrefix, splitTargets, validatePrefix } from './api.js';
import { isValidHttpUrl, parseHeaderLines, parseIpList, validIpList } from '../http/validation.js';

function inspectImport(data, currentPrefixes, settingKeys) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { success: false, error: '配置必须是 JSON 对象' };
    if (data.routes !== undefined && !Array.isArray(data.routes)) return { success: false, error: 'routes 必须是数组' };
    const routes = data.routes || [];
    if (routes.length > 1000) return { success: false, error: '单次导入最多 1000 条线路，请分批导入' };
    const current = new Set(currentPrefixes);
    if (data.settings?.domain_proxy_rules) {
        try {
            const rules = JSON.parse(data.settings.domain_proxy_rules);
            if (!rules || typeof rules !== 'object' || Array.isArray(rules)) throw new Error('Invalid rules');
        } catch { return { success: false, error: '域名映射规则必须是合法 JSON 对象' }; }
    }
    const seen = new Set();
    const added = [], overwritten = [], invalid = [];
    for (const route of routes) {
        const prefix = normalizePrefix(route?.prefix);
        const targets = splitTargets(route?.target);
        const streams = splitTargets(route?.stream_target);
        const valid = !validatePrefix(prefix) && targets.length && targets.every(isValidHttpUrl)
            && streams.every(isValidHttpUrl)
            && !parseHeaderLines(route?.custom_headers).error && validIpList(parseIpList(route?.ip_allow)) && validIpList(parseIpList(route?.ip_block));
        if (!valid || seen.has(prefix)) invalid.push({ prefix: prefix.slice(0, 64), reason: seen.has(prefix) ? '重复路径' : '路径、目标或高级规则无效' });
        else (current.has(prefix) ? overwritten : added).push(prefix);
        seen.add(prefix);
    }
    return { success: true, canImport: invalid.length === 0, added, overwritten, invalid,
        domainEntries: Array.isArray(data.domains) ? data.domains.length : 0,
        settings: data.settings && typeof data.settings === 'object' ? Object.keys(data.settings).filter(key => settingKeys.includes(key)) : [],
        notice: '只读预检，不写数据库、不修改 DNS。域名条目仍由导入端进行最终校验；配置值与密钥不在预检结果中回显。',
    };
}

export { inspectImport };
