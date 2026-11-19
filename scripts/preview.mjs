import http from 'node:http';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Miniflare, Log, LogLevel } from 'miniflare';
import { buildAll, bundle, root } from './build.mjs';
import { fixtureResponse } from './fixtures.mjs';

await buildAll();
const services = [], servers = [];
let stopping = false;
try {
  for (const [edition, port] of [['personal', 4273], ['multi', 4274]]) {
    await bundle(`src/local/${edition}.js`, `dist/preview-${edition}.mjs`);
    await mkdir(path.join(root, '.local/d1', edition), { recursive: true, mode: 0o700 });
    const mf = new Miniflare({
      host: '127.0.0.1', port: 0, modules: true, scriptPath: path.join(root, `dist/preview-${edition}.mjs`),
      compatibilityDate: '2025-05-15', compatibilityFlags: ['nodejs_compat'],
      bindings: { LOCAL_PREVIEW: '1', ADMIN_TOKEN: randomBytes(32).toString('hex'), BASE_DOMAIN: 'localhost', USER_DOMAIN: 'localhost', DNS_RECORD_NAME: '', DISABLE_DIRECT_PROXY: '1' },
      d1Databases: { DB: `local-${edition}` }, d1Persist: path.join(root, '.local/d1', edition),
      outboundService: fixtureResponse, log: new Log(LogLevel.ERROR),
    });
    services.push(mf);
    const server = http.createServer(async (req, res) => {
      const host = req.headers.host;
      if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host)) { res.writeHead(403); res.end('Loopback Host required'); return; }
      const url = new URL(req.url, `http://${host}`);
      const controller = new AbortController();
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      try {
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        // dispatchFetch otherwise follows the login redirect and drops the
        // intermediate Set-Cookie before the browser can establish its session.
        const init = { method: req.method, headers, signal: controller.signal, redirect: 'manual' };
        if (!['GET','HEAD'].includes(req.method)) { init.body = Readable.toWeb(req); init.duplex = 'half'; }
        const response = await mf.dispatchFetch(url.href, init);
        res.statusCode = response.status;
        for (const [name,value] of response.headers) if (!['transfer-encoding','connection','set-cookie'].includes(name)) res.setHeader(name,value);
        if (response.headers.has('set-cookie')) res.setHeader('Set-Cookie', response.headers.getSetCookie());
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
        if (req.method === 'HEAD' || !response.body) res.end(); else {
          const stream = Readable.fromWeb(response.body);
          stream.on('error', () => res.destroy()); stream.pipe(res);
          res.on('close', () => stream.destroy());
        }
      } catch {
        if (!res.headersSent && !res.destroyed) { res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('本地预览请求失败，请查看本地测试结果。'); }
        else res.destroy();
      }
    });
    await new Promise((resolve,reject) => { server.once('error',reject); server.listen(port,'127.0.0.1',resolve); });
    servers.push(server);
    const ready = await mf.dispatchFetch(`http://127.0.0.1:${port}/__preview/health`, { redirect: 'manual' });
    if (ready.status !== 200) throw new Error(`${edition} preview initialization failed`);
    console.log(`${edition}: http://127.0.0.1:${port}/__preview (loopback only, isolated D1, outbound network blocked)`);
  }
} catch (error) {
  console.error('Local preview failed:', error.name, error.message);
  await stop(); process.exitCode = 1;
}
async function stop() {
  if (stopping) return; stopping = true;
  await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
  await Promise.all(services.map(service => service.dispose()));
}
process.once('SIGINT', async () => { await stop(); process.exit(); });
process.once('SIGTERM', async () => { await stop(); process.exit(); });
