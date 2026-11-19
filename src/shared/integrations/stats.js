// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { getClientCacheKey } from "./../http/validation.js";

async function getEdgeInfo(request) {
    const cf = request.cf || {};
    let traceIp = "";
    let traceColo = cf.colo || "未知";
    try {
        const tr = await fetch("https://1.1.1.1/cdn-cgi/trace", { headers: { "User-Agent": "CF-Worker-Trace" } });
        const text = await tr.text();
        const coloM = text.match(/colo=([A-Z0-9]+)/);
        const ipM = text.match(/ip=([^\n]+)/);
        if (coloM)
            traceColo = coloM[1];
        if (ipM)
            traceIp = ipM[1].trim();
    }
    catch (_) {
    }
    return {
        clientIp: request.headers.get("cf-connecting-ip") || "未知",
        entryColo: cf.colo || "未知",
        entryCountry: cf.country || "未知",
        entryCity: cf.city || "",
        edgeIp: traceIp || "—",
        egressColo: traceColo,
        cacheKey: getClientCacheKey(request)
    };
}

export { getEdgeInfo };
