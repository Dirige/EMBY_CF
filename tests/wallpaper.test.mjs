import assert from 'node:assert/strict';
import test from 'node:test';

test('Bing background refreshes once per Shanghai day and remains cached between views', async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const firstMoment = Date.parse('2026-11-20T15:59:00Z'); // Shanghai 23:59
  let now = firstMoment;
  let metadataCalls = 0;
  const imageCalls = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.includes('HPImageArchive.aspx')) {
      metadataCalls++;
      assert.equal(options.cf?.cacheTtl, 300);
      const image = metadataCalls === 1 ? 'one' : 'two';
      return new Response(JSON.stringify({ images: [{ url: `https://th.bing.com/${image}.jpg` }] }), { headers: { 'Content-Type': 'application/json' } });
    }
    imageCalls.push(url);
    return new Response('image-bytes', { headers: { 'Content-Type': 'image/jpeg' } });
  };
  Date.now = () => now;
  try {
    const { wallpaperResponse } = await import(`../src/shared/ui/wallpaper.js?daily-test=${Math.random()}`);
    const first = await wallpaperResponse();
    assert.equal(first.status, 200);
    assert.match(first.headers.get('Cache-Control'), /max-age=3600/);
    assert.equal(await first.text(), 'image-bytes');

    const sameDayHead = await wallpaperResponse('HEAD');
    assert.equal(sameDayHead.status, 200);
    assert.equal(await sameDayHead.text(), '');
    assert.equal(metadataCalls, 1);

    now = Date.parse('2026-11-20T16:01:00Z'); // Shanghai 00:01 next day
    const nextDay = await wallpaperResponse();
    assert.equal(nextDay.status, 200);
    assert.equal(await nextDay.text(), 'image-bytes');
    assert.equal(metadataCalls, 2);
    assert.equal(imageCalls[0], 'https://th.bing.com/one.jpg');
    assert.equal(imageCalls.at(-1), 'https://th.bing.com/two.jpg');
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
