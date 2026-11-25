// Shared presentation resource; no dependency on proxy/auth/database modules.
let cached = { day: '', url: '' };

function shanghaiDay(timestamp) {
  return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export async function wallpaperResponse(method = 'GET') {
  if (!['GET', 'HEAD'].includes(method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const now = Date.now();
  const day = shanghaiDay(now);
  if (!cached.url || cached.day !== day) {
    try {
      const response = await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1', { signal: AbortSignal.timeout(4000), cf: { cacheTtl: 300, cacheEverything: true } });
      const data = await response.json();
      const path = data?.images?.[0]?.url;
      if (path) {
        const image = new URL(path, 'https://www.bing.com');
        if (image.protocol === 'https:' && ['www.bing.com', 'bing.com', 'th.bing.com'].includes(image.hostname) && !image.username && !image.password) cached = { day, url: image.href };
      }
    } catch { /* The CSS gradient remains usable when wallpaper is unavailable. */ }
  }
  if (!cached.url) return new Response('wallpaper unavailable', { status: 503 });
  let image;
  try { image = await fetch(cached.url, { signal: AbortSignal.timeout(6000), cf: { cacheEverything: true, cacheTtl: 3600 } }); }
  catch { return new Response('wallpaper unavailable', { status: 503 }); }
  if (!image.ok || !/^image\//i.test(image.headers.get('Content-Type') || '')) {
    void image.body?.cancel().catch(() => {});
    return new Response('wallpaper unavailable', { status: 503 });
  }
  const headers = new Headers(image.headers);
  headers.set('Cache-Control', 'public, max-age=3600');
  if (method === 'HEAD') {
    await image.body?.cancel();
    return new Response(null, { status: image.status, headers });
  }
  return new Response(image.body, { status: image.status, headers });
}
