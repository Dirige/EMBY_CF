// Local, reproducible data-plane comparison. No Emby, CF account or network
// origin is accessed. This is not a player startup or Internet throughput test.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { Miniflare, Log, LogLevel } from 'miniflare';
import { root, textAssets } from './build.mjs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

const rounds = 3;
const payloadBytes = 2 * 1024 * 1024;
const block = Buffer.alloc(128 * 1024, 42);
const output = path.join(root, '.local/bench');
await mkdir(output, { recursive: true });
const report = { generatedAt: new Date().toISOString(), node: process.version, platform: `${os.platform()}-${os.arch()}`, cpu: os.cpus()[0]?.model,
  status: 'running',
  scope: 'Loopback HTTP + workerd pipeline + synthetic HTTP origin. No real media, no production services. Not player first frame or CF performance.',
  config: { rounds, payloadBytes, concurrency: [1, 8, 32], warmups: 2 }, results: [] };
await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');

async function workerdRss() {
  let bytes = 0;
  for (const id of await readdir('/proc')) {
    if (!/^\d+$/.test(id)) continue;
    try {
      const status = await readFile(`/proc/${id}/status`, 'utf8');
      if (/^Name:\s+workerd$/m.test(status) && Number(status.match(/^PPid:\s+(\d+)/m)?.[1]) === process.pid) bytes += Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0) * 1024;
    } catch {}
  }
  return bytes;
}

for (const edition of ['personal', 'multi']) {
  // Reverse order for the second edition to reduce systematic ordering bias.
  for (const mode of edition === 'personal' ? ['baseline', 'refactor'] : ['refactor', 'baseline']) {
    const hook = mode === 'baseline'
      ? (await readFile(path.join(root, `tests/baselines/${edition}-worker.js`), 'utf8')) + '\nexport { proxyDirectUrl as benchProxy };'
      : `export { proxyDirectUrl as benchProxy } from '${root}/src/editions/${edition}/proxy/pipeline.js';`;
    const result = await build({
      stdin: { contents: `import { benchProxy } from 'bench:proxy';
const DB={prepare(){return {bind(){return this},async all(){return {results:[]}},async first(){return null},async run(){return {success:true}}}}};
export default {fetch(request,env,ctx){const u=new URL(request.url);return benchProxy(request,{DB},ctx,['https://synthetic.test'+u.pathname+u.search],{enableCache:false});}};`, resolveDir: root },
      bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false, external: ['node:*'],
      plugins: [textAssets, { name: 'benchmark-hooks', setup(builder) {
        builder.onResolve({ filter: /^bench:proxy$/ }, () => ({ path: 'proxy', namespace: 'benchmark-hook' }));
        builder.onLoad({ filter: /.*/, namespace: 'benchmark-hook' }, () => ({ contents: hook, resolveDir: root, loader: 'js' }));
      } }],
    });
    const mf = new Miniflare({ host: '127.0.0.1', port: 0, modules: true, script: result.outputFiles[0].text,
      compatibilityDate: '2025-05-15', compatibilityFlags: ['nodejs_compat'], log: new Log(LogLevel.ERROR),
      outboundService: { async node(req, res) {
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
        res.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Length': String(payloadBytes), 'Content-Range': `bytes 0-${payloadBytes - 1}/${payloadBytes}`, 'Accept-Ranges': 'bytes' });
        if (req.method === 'HEAD') { res.end(); return; }
        try {
          for (let offset = 0; offset < payloadBytes; offset += block.length) {
            if (res.destroyed) return;
            if (!res.write(block)) {
              await new Promise(resolve => {
                const done = () => { res.off('drain', done); res.off('close', done); resolve(); };
                res.once('drain', done); res.once('close', done);
              });
            }
          }
          res.end();
        } catch { res.destroy(); }
      } },
    });
    try {
      const endpoint = await mf.ready;
      const transfer = async () => {
        const start = performance.now();
        const response = await fetch(new URL('/Videos/fixture/stream.mkv', endpoint), { headers: { Range: `bytes=0-${payloadBytes - 1}` }, signal: AbortSignal.timeout(30_000) });
        if (response.status !== 206) throw new Error(`Unexpected benchmark status ${response.status}`);
        const reader = response.body.getReader();
        let firstByteMs = null, bytes = 0;
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          firstByteMs ??= performance.now() - start;
          bytes += next.value.byteLength;
          if (next.value[0] !== 42 || next.value.at(-1) !== 42) throw new Error('Synthetic stream content mismatch');
        }
        if (bytes !== payloadBytes) throw new Error('Truncated benchmark payload');
        return { firstByteMs, durationMs: performance.now() - start, bytes };
      };
      for (let i = 0; i < 2; i++) await transfer();
      for (const concurrency of report.config.concurrency) {
        const samples = [];
        let peakNodeRss = process.memoryUsage().rss, peakWorkerdRss = await workerdRss();
        const sampleMemory = async () => { peakNodeRss = Math.max(peakNodeRss, process.memoryUsage().rss); peakWorkerdRss = Math.max(peakWorkerdRss, await workerdRss()); };
        let sampling = false;
        const timer = setInterval(() => { if (!sampling) { sampling = true; void sampleMemory().finally(() => { sampling = false; }); } }, 100);
        const start = performance.now();
        try {
          for (let round = 0; round < rounds; round++) samples.push(...await Promise.all(Array.from({ length: concurrency }, transfer)));
        } finally { clearInterval(timer); }
        const durationMs = performance.now() - start;
        await sampleMemory();
        const latencies = samples.map(sample => sample.firstByteMs).sort((a, b) => a - b);
        const percentile = ratio => Number(latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * ratio) - 1)].toFixed(2));
        const row = { edition, mode, concurrency, samples: samples.length, bundleSha256: createHash('sha256').update(result.outputFiles[0].contents).digest('hex'), firstByteP50Ms: percentile(.5), firstByteP95Ms: percentile(.95), aggregateMiBps: Number((samples.length * payloadBytes / 1048576 / (durationMs / 1000)).toFixed(2)), peakNodeRssMiB: Number((peakNodeRss / 1048576).toFixed(1)), peakWorkerdRssMiB: Number((peakWorkerdRss / 1048576).toFixed(1)), failures: 0 };
        report.results.push(row);
        await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
        console.log(JSON.stringify(row));
      }
    } finally { await mf.dispose(); }
  }
}
report.status = 'complete';
await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Local benchmark saved to .local/bench/results.json');
