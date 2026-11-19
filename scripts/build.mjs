import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
export const root = path.resolve(import.meta.dirname, '..');
export const textAssets = {
  name: 'editable-text-assets',
  setup(build) {
    build.onResolve({ filter: /\?text$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.slice(0, -5)), namespace: 'text-asset' }));
    build.onLoad({ filter: /.*/, namespace: 'text-asset' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text', watchFiles: [args.path] }));
  },
};
export async function bundle(entry, outfile, extra = {}) {
  return build({ entryPoints: [path.join(root, entry)], outfile: path.join(root, outfile), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', legalComments: 'inline', plugins: [textAssets], metafile: true, ...extra });
}
export async function buildAll() {
  await mkdir(path.join(root, 'dist'), { recursive: true });
  const manifest = { channel: 'local-acceptance', baseline: '4e0357e', editions: {} };
  for (const edition of ['personal', 'multi']) {
    const result = await bundle(`src/${edition}.js`, `dist/${edition}.mjs`);
    const bytes = await readFile(path.join(root, `dist/${edition}.mjs`));
    manifest.editions[edition] = { file: `${edition}.mjs`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    await writeFile(path.join(root, `dist/${edition}.meta.json`), JSON.stringify(result.metafile, null, 2));
    console.log(`${edition}: ${bytes.length} bytes, sha256 ${manifest.editions[edition].sha256.slice(0,16)}`);
  }
  await writeFile(path.join(root, 'dist/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
if (process.argv[1] === path.join(import.meta.dirname, 'build.mjs')) await buildAll();
