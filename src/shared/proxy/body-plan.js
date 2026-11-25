// Buffer explicitly small bodies, or bounded unknown bodies only when a caller
// opts in for a narrow endpoint. General uploads remain one-shot streams;
// no clone/tee may silently retain an unbounded copy for retries.
const MAX_REPLAY_BYTES = 256 * 1024;
const REQUEST_BODY_READ_MS = 5000;

function streamFromReader(reader, prefix = []) {
    let index = 0;
    return new ReadableStream({
        async pull(controller) {
            try {
                if (index < prefix.length) {
                    const chunk = prefix[index];
                    prefix[index++] = null;
                    controller.enqueue(chunk);
                    return;
                }
                const { done, value } = await reader.read();
                if (done) {
                    reader.releaseLock();
                    controller.close();
                } else controller.enqueue(value);
            } catch (error) {
                reader.releaseLock();
                controller.error(error);
            }
        },
        async cancel(reason) {
            prefix.length = 0;
            try { await reader.cancel(reason); }
            finally { reader.releaseLock(); }
        },
    }, { highWaterMark: 0 });
}

async function prepareRequestBody(request, maxBytes = MAX_REPLAY_BYTES, timeoutMs = REQUEST_BODY_READ_MS, { bufferUnknown = false } = {}) {
    if (request.method === 'GET' || request.method === 'HEAD' || !request.body) {
        return { replayable: true, apply() {} };
    }
    let body = request.body;
    let replayable = false;
    let overflow = false;
    const rawLength = request.headers.get('Content-Length');
    const length = /^\d+$/.test(rawLength || '') ? Number(rawLength) : NaN;
    if ((Number.isSafeInteger(length) && length <= maxBytes) || (bufferUnknown && rawLength === null)) {
        const reader = body.getReader();
        const chunks = [];
        let total = 0;
        const deadline = Date.now() + timeoutMs;
        const onAbort = () => { void reader.cancel(request.signal.reason).catch(() => {}); };
        request.signal.addEventListener('abort', onAbort, { once: true });
        try {
            while (true) {
                request.signal.throwIfAborted();
                let timer;
                let part;
                try {
                    part = await Promise.race([reader.read(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Request body read timed out')), Math.max(1, deadline - Date.now())); })]);
                } finally { clearTimeout(timer); }
                request.signal.throwIfAborted();
                const { done, value } = part;
                if (done) {
                    const bytes = new Uint8Array(total);
                    let offset = 0;
                    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
                    body = bytes;
                    replayable = true;
                    reader.releaseLock();
                    break;
                }
                chunks.push(value);
                total += value.byteLength;
                if (total > maxBytes) {
                    // A lying Content-Length must not cause unlimited buffering
                    // or truncate the upload. Replay the prefix then keep streaming.
                    body = streamFromReader(reader, chunks);
                    overflow = true;
                    break;
                }
            }
        } catch (error) {
            void reader.cancel(error).catch(() => {});
            reader.releaseLock();
            throw error;
        } finally { request.signal.removeEventListener('abort', onAbort); }
    }
    let used = false;
    return {
        replayable,
        apply(init) {
            if (!replayable && used) throw new Error('Streaming request body cannot be replayed');
            used = true;
            init.body = body;
            if (init.headers?.has('Content-Length')) {
                if (overflow) init.headers.delete('Content-Length');
                else if (replayable) init.headers.set('Content-Length', String(body.byteLength));
            }
            if (!replayable) init.duplex = 'half';
        },
    };
}

export { MAX_REPLAY_BYTES, REQUEST_BODY_READ_MS, prepareRequestBody, streamFromReader };
