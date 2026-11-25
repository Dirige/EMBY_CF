import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { root } from '../../scripts/build.mjs';

for (const edition of ['personal', 'multi']) {
  test(`offline ${edition}: opens as a local file and every screenshot loads without network`, async ({ page, context }) => {
    await context.setOffline(true);
    const remote = [], errors = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) remote.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, 'docs/offline', edition + '.html')).href);
    await expect(page.locator('h1')).toContainText(edition === 'personal' ? '个人版' : '多人版');
    const state = await page.locator('main img').evaluateAll(images => images.map(image => ({ loaded: image.complete && image.naturalWidth > 0, embedded: image.src.startsWith('data:image/') })));
    expect(state.length).toBeGreaterThanOrEqual(8);
    expect(state.every(image => image.loaded && image.embedded)).toBe(true);
    expect(remote).toEqual([]);
    expect(errors).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
