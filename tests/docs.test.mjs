import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { repoRoot, guides, offlineDocument, inlineLocalImage } from '../scripts/build-docs.mjs';

const maintainedDocs = ['README.md', 'DEPLOY.md', 'personal/README.md', 'relay/README.md', 'docs/UPGRADE.md', ...guides.map(g => g.file)];

test('deployment docs: all maintained relative Markdown links and images exist', async () => {
  for (const name of maintainedDocs) {
    const filename = path.join(repoRoot, name), markdown = await readFile(filename, 'utf8');
    for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const href = match[1].split('#')[0];
      if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue;
      await assert.doesNotReject(access(path.resolve(path.dirname(filename), decodeURIComponent(href))), `${name}: ${href}`);
    }
  }
});

test('deployment docs: all original tutorial illustrations are local and metadata-stripped', async () => {
  const { createHash } = await import('node:crypto');
  const manifest = JSON.parse(await readFile(path.join(repoRoot, 'docs/assets/deploy/manifest.json'), 'utf8'));
  assert.equal(manifest.images.length, 38);
  assert.ok(manifest.images.every(image => image.reviewed && image.metadataRemoved));
  for (const image of manifest.images) {
    const data = await readFile(path.join(repoRoot, 'docs/assets/deploy', image.file));
    assert.equal(createHash('sha256').update(data).digest('hex'), image.sha256);
    assert.equal(data.length, image.bytes);
    assert.equal(data.toString('ascii', 8, 12), 'WEBP');
  }
  for (const guide of guides) {
    const markdown = await readFile(path.join(repoRoot, guide.file), 'utf8');
    assert.ok(!/!\[[^\]]*\]\(\s*(?:https?:|\/\/)/.test(markdown));
    assert.ok(!/kdocs\.cn|api\/v3\/office\/copy/.test(markdown));
    assert.match(markdown, /优选[\s\S]{0,100}灰云/, 'Preferred IP/domain instructions must explicitly keep DNS-only');
  }
});

for (const guide of guides) {
  test(`deployment docs ${guide.edition}: standalone HTML requires no remote resource or script`, async () => {
    const html = await offlineDocument(guide);
    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(html.includes('default-src &#39;none&#39;') || html.includes("default-src 'none'"));
    assert.ok(!/<script\b|<iframe\b|<link\b|@import|url\(/i.test(html));
    const images = [...html.matchAll(/<img\b[^>]*src="([^"]+)"/g)];
    assert.ok(images.length >= 8);
    assert.ok(images.every(([, source]) => source.startsWith('data:image/webp;base64,')));
    assert.ok(!/src="https?:|href="https?:[^\"]+\.(?:css|js)"/i.test(html));
    assert.equal(html, await offlineDocument(guide), 'Offline build must be deterministic');
  });
}

test('deployment docs: image inliner rejects external resources and paths outside the repository', async () => {
  const guide = path.join(repoRoot, guides[0].file);
  for (const href of ['https://example.test/image.png', 'http://example.test/image.png', '//example.test/image.png', 'data:image/png;base64,fixture', '/etc/passwd']) {
    await assert.rejects(inlineLocalImage(href, guide), /local relative/);
  }
  await assert.rejects(inlineLocalImage('../../../..', guide), /escapes repository/);
  await assert.rejects(inlineLocalImage('../package.json', guide), /Unsupported/);
});

test('deployment docs: copy/paste Worker artifacts match each current source build manifest', async () => {
  const { createHash } = await import('node:crypto');
  const manifest = JSON.parse(await readFile(path.join(repoRoot, 'dist/manifest.json'), 'utf8'));
  for (const [edition, name] of [['personal', 'personal/worker.js'], ['multi', 'worker.js']]) {
    const publicArtifact = await readFile(path.join(repoRoot, name));
    assert.equal(createHash('sha256').update(publicArtifact).digest('hex'), manifest.editions[edition].sha256);
    // Shared page builders retain optional labels and header sanitization must
    // recognize preview cookie names. Verify imported modules, not substrings.
    const meta = JSON.parse(await readFile(path.join(repoRoot, `dist/${edition}.meta.json`), 'utf8'));
    assert.ok(Object.keys(meta.inputs).every(name => !name.startsWith('src/local/') && name !== 'scripts/fixtures.mjs' && !name.startsWith('tests/')));
    assert.ok(Object.values(meta.outputs).some(output => output.entryPoint === `src/${edition}.js`));
  }
});
