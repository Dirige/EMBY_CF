// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { FALLBACK_LOG_MS } from "./../../../shared/proxy/pipeline.js";

var fallbackLogAt = /* @__PURE__ */ new Map();

function fallbackLogThrottled(key) {
    const now = Date.now();
    if (now - (fallbackLogAt.get(key) || 0) < FALLBACK_LOG_MS)
        return true;
    fallbackLogAt.set(key, now);
    while (fallbackLogAt.size > 512) fallbackLogAt.delete(fallbackLogAt.keys().next().value);
    return false;
}

var hostDownUntil = /* @__PURE__ */ new Map();

var relayPreferences = /* @__PURE__ */ new Map();

var lastPlayTouched = /* @__PURE__ */ new Map();

var CONFIG = {
    enableStats: true
};

var progressMap = /* @__PURE__ */ new Map();

var rateMap = /* @__PURE__ */ new Map();

function rateLimited(ip, limit) {
    if (!limit)
        return false;
    const now = Date.now();
    const rec = rateMap.get(ip);
    if (!rec || now - rec.start > 6e4) {
        rateMap.set(ip, { start: now, n: 1 });
    }
    else {
        rec.n++;
        if (rec.n > limit)
            return true;
    }
    if (rateMap.size > 2e4) {
        for (const [k, v] of rateMap)
            if (now - v.start > 6e4)
                rateMap.delete(k);
    }
    return false;
}

export { fallbackLogAt, fallbackLogThrottled, hostDownUntil, relayPreferences, lastPlayTouched, CONFIG, progressMap, rateMap, rateLimited };
