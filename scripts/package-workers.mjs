import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { buildAll, root } from './build.mjs';

// Public copy/paste artifacts preserve the historical GitHub download paths.
// Source lives in src/ and web/; regression baselines live in tests/baselines/.
export async function packageWorkers() {
  const manifest = await buildAll();
  for (const [edition, filename] of [['personal', 'personal/worker.js'], ['multi', 'worker.js']]) {
    const data = await readFile(path.join(root, 'dist', edition + '.mjs'));
    if (createHash('sha256').update(data).digest('hex') !== manifest.editions[edition].sha256) throw new Error('Build hash mismatch');
    await writeFile(path.join(root, filename), data);
  }
  return manifest;
}
if (process.argv[1] === path.join(import.meta.dirname, 'package-workers.mjs')) await packageWorkers();
