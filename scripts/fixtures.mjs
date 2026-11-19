/** Entirely synthetic upstream. Never forwards a request to the network. */
export function fixtureResponse(request) {
  const url = new URL(request.url);
  if (!['upstream.test', 'media.test'].includes(url.hostname)) return new Response('Local preview: external network access disabled', { status: 503 });
  if (url.pathname.endsWith('/System/Info/Public')) return Response.json({ ServerName: 'LOCAL TEST UPSTREAM', Version: 'fixture', Id: 'local-only' });
  if (url.pathname.endsWith('/PlaybackInfo')) return Response.json({ MediaSources: [{ Id: 'fixture', DirectStreamUrl: 'https://media.test/local-fixture.bin' }] });
  const payload = new TextEncoder().encode('LOCAL FIXTURE - NOT MEDIA');
  const range = request.headers.get('Range')?.match(/^bytes=(\d+)-(\d*)$/);
  if (range) {
    const start = Number(range[1]), end = Math.min(range[2] ? Number(range[2]) : payload.length - 1, payload.length - 1);
    if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${payload.length}` } });
    return new Response(request.method === 'HEAD' ? null : payload.slice(start, end + 1), { status: 206, headers: { 'Content-Range': `bytes ${start}-${end}/${payload.length}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes', 'Content-Type': 'application/octet-stream' } });
  }
  return new Response(request.method === 'HEAD' ? null : payload, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(payload.length), 'Accept-Ranges': 'bytes' } });
}
