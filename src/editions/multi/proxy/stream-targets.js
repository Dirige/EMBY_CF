// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { isPrivateHost, isValidHttpUrl } from "./../../../shared/http/validation.js";

function getStreamTargetParts(raw) {
    try {
        const url = new URL(raw);
        if (!isValidHttpUrl(raw) || url.username || url.password || url.search || url.hash || isPrivateHost(url.hostname))
            return null;
        return { origin: url.origin, base: url.pathname.replace(/\/+$/, "") };
    }
    catch {
        return null;
    }
}

function matchStreamTarget(url, targets) {
    if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password || isPrivateHost(url.hostname))
        return null;
    let match = null;
    for (let index = 0; index < targets.length; index++) {
        const parts = getStreamTargetParts(targets[index]);
        if (!parts || url.origin !== parts.origin)
            continue;
        if (url.pathname !== parts.base && !url.pathname.startsWith(parts.base + "/"))
            continue;
        if (!match || parts.base.length > match.base.length)
            match = { ...parts, index };
    }
    return match;
}

function getStreamProxyLocation(request, target, targets, routePath) {
    const match = matchStreamTarget(target, targets);
    if (!match || !routePath)
        return "";
    return new URL(request.url).origin + routePath + "/__stream/" + match.index + target.pathname.slice(match.base.length) + target.search + target.hash;
}

function rewritePlaybackStreamUrls(data, request, targets, routePath, upstreamUrl) {
    let changed = false;
    const rewrite = (obj, key) => {
        const value = obj && obj[key];
        if (typeof value !== "string" || !/^(?:https?:)?\/\//i.test(value))
            return;
        try {
            const target = new URL(value, upstreamUrl);
            const location = getStreamProxyLocation(request, target, targets, routePath);
            if (location && location !== value) {
                obj[key] = location;
                changed = true;
            }
        }
        catch {
        }
    };
    for (const source of Array.isArray(data?.MediaSources) ? data.MediaSources : []) {
        rewrite(source, "DirectStreamUrl");
        rewrite(source, "TranscodingUrl");
        for (const stream of Array.isArray(source?.MediaStreams) ? source.MediaStreams : [])
            rewrite(stream, "DeliveryUrl");
    }
    return changed;
}

export { getStreamTargetParts, matchStreamTarget, getStreamProxyLocation, rewritePlaybackStreamUrls };
