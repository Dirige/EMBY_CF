import SPEED_TOOLS_SOURCE from "./../../../../web/multi/speed-test.js?text";
// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.


var SPEED_TOOLS = SPEED_TOOLS_SOURCE;

function safeHttpUrl(v, fallback) {
    const s = String(v == null ? "" : v).trim();
    return /^https?:\/\//i.test(s) ? s : fallback;
}

export { SPEED_TOOLS, safeHttpUrl };
