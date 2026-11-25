// Optional, explicit UI fixture setup. Never invoked by preview/build/tests.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from './build.mjs';

async function bytes(response, limit) {
  if (!response.ok) throw new Error('Wallpaper source unavailable');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { void reader.cancel().catch(() => {}); throw new Error('Wallpaper fixture exceeds size limit'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}

const metadata = await bytes(await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1', { signal: AbortSignal.timeout(8000) }), 65536);
const image = JSON.parse(metadata.toString()).images?.[0];
const url = new URL(image?.url || '', 'https://www.bing.com');
if (url.protocol !== 'https:' || !['www.bing.com', 'bing.com', 'th.bing.com'].includes(url.hostname) || url.username || url.password) throw new Error('Unexpected wallpaper source');
const body = await bytes(await fetch(url, { signal: AbortSignal.timeout(15000) }), 5 * 1024 * 1024);
if (body[0] !== 255 || body[1] !== 216 || body[2] !== 255) throw new Error('Wallpaper fixture must be JPEG');
const folder = path.join(root, '.local/assets');
await mkdir(folder, { recursive: true });
await writeFile(path.join(folder, 'wallpaper.jpg'), body);
await writeFile(path.join(folder, 'wallpaper-source.json'), JSON.stringify({ source: url.href, copyright: image.copyright || '', usage: 'Local visual acceptance only; do not publish this photo as project source.' }, null, 2));
console.log(`Cached local wallpaper fixture (${body.length} bytes). Preview remains network-isolated.`);
