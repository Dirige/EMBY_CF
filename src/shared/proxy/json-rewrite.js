import { streamFromReader } from './body-plan.js';
import { sanitizeResponseHeaders } from '../http/responses.js';

const MAX_METADATA_BYTES = 1024 * 1024;
const METADATA_READ_MS = 5_000;
const MAX_METADATA_READERS = 4;
let activeReaders = 0;

async function rewriteJsonResponse(response, rewrite, options) {
    // Never queue playback behind another client's JSON work. Saturated
    // isolates use the unmodified native stream instead of retaining clones.
    if (activeReaders >= MAX_METADATA_READERS) return response;
    activeReaders++;
    try { return await rewriteBoundedJsonResponse(response, rewrite, options); }
    finally { activeReaders--; }
}

async function rewriteBoundedJsonResponse(response, rewrite, { limit = MAX_METADATA_BYTES, timeoutMs = METADATA_READ_MS } = {}) {
    const encoding = response.headers.get('Content-Encoding');
    const declared = response.headers.get('Content-Length');
    if (!response.body || encoding && encoding !== 'identity' || /^\d+$/.test(declared || '') && Number(declared) > limit) return response;
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    const deadline = Date.now() + timeoutMs;
    try {
        while (true) {
            let timer;
            let part;
            try {
                part = await Promise.race([
                    reader.read(),
                    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Metadata read timed out')), Math.max(1, deadline - Date.now())); }),
                ]);
            } finally { clearTimeout(timer); }
            if (part.done) break;
            chunks.push(part.value);
            total += part.value.byteLength;
            if (total > limit) {
                const headers = sanitizeResponseHeaders(response.headers);
                headers.delete('Content-Length');
                return new Response(streamFromReader(reader, chunks), { status: response.status, statusText: response.statusText, headers });
            }
        }
        reader.releaseLock();
    } catch {
        void reader.cancel().catch(() => {});
        reader.releaseLock();
        return new Response('Upstream metadata unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try {
        const data = JSON.parse(new TextDecoder().decode(bytes));
        if (rewrite(data)) {
            const headers = sanitizeResponseHeaders(response.headers);
            for (const name of ['Content-Length', 'Content-Encoding', 'ETag', 'Content-MD5', 'Digest']) headers.delete(name);
            headers.set('Content-Type', 'application/json; charset=utf-8');
            headers.set('Cache-Control', 'no-store');
            return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
        }
    } catch { /* Invalid/unmatched JSON passes through byte-for-byte. */ }
    return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
}

export { rewriteJsonResponse, MAX_METADATA_BYTES, METADATA_READ_MS, MAX_METADATA_READERS };
