// Shared presentation resource; no dependency on proxy/auth/database modules.
let cached = { at: 0, url: '' };
export async function wallpaperResponse(method = 'GET') {
  if (!['GET', 'HEAD'].includes(method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const now = Date.now();
  if (!cached.url || now - cached.at > 3_600_000) {
    try {
      const response = await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1', { cf: { cacheTtl: 3600, cacheEverything: true } });
      const data = await response.json();
      const path = data?.images?.[0]?.url;
      if (path) cached = { at: now, url: new URL(path, 'https://www.bing.com').href };
    } catch { /* The CSS gradient remains usable when wallpaper is unavailable. */ }
  }
  if (!cached.url) return new Response('wallpaper unavailable', { status: 503 });
  const image = await fetch(cached.url, { cf: { cacheEverything: true, cacheTtl: 21600 } });
  const headers = new Headers(image.headers);
  headers.set('Cache-Control', 'public, max-age=21600');
  if (method === 'HEAD') {
    await image.body?.cancel();
    return new Response(null, { status: image.status, headers });
  }
  return new Response(image.body, { status: image.status, headers });
}
