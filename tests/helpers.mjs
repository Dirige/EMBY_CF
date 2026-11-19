import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { root, textAssets } from '../scripts/build.mjs';

const compiled = new Map();
export async function loadEdition(edition, baseline = false) {
  const key = `${edition}-${baseline ? 'baseline' : 'refactor'}`;
  if (!compiled.has(key)) compiled.set(key, (async () => {
    let contents;
    if (baseline) {
      contents = await readFile(path.join(root, edition === 'personal' ? 'personal/worker.js' : 'worker.js'), 'utf8');
      contents += '\nexport { resolveProxyTarget, proxyDirectUrl, buildUpstreamHeaders, buildAdminHtml, MANUAL_REDIRECT_DOMAINS, hostDownUntil, classifyRequest };\n';
    } else {
      contents = `export { default } from './src/${edition}.js';
export { resolveProxyTarget } from './src/editions/${edition}/proxy/routes.js';
export { proxyDirectUrl } from './src/editions/${edition}/proxy/pipeline.js';
export { hostDownUntil } from './src/editions/${edition}/proxy/state.js';
export { buildUpstreamHeaders } from './src/shared/proxy/pipeline.js';
export { buildAdminHtml } from './web/${edition}/pages.js';
export { MANUAL_REDIRECT_DOMAINS } from './src/shared/rules/netdisk.js';
export { classifyRequest } from './src/shared/http/primitives.js';`;
    }
    const result = await build({ stdin: { contents, resolveDir: root, sourcefile: `${key}-hooks.js`, loader: 'js' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', write: false, plugins: [textAssets] });
    await mkdir(path.join(root,'dist/testing'),{recursive:true});
    const filename=path.join(root,'dist/testing',key+'.mjs');
    await writeFile(filename,result.outputFiles[0].contents);
    return filename;
  })());
  return import(pathToFileURL(await compiled.get(key)).href+'?isolate='+randomUUID());
}

export function fixture(module, edition, overrides = {}, rawSettings = {}) {
  const route = { prefix: 'demo', target: 'https://api.test', stream_target: edition === 'multi' ? 'https://media.test' : '', compat_mode: 'off', cache_img: 'on', ip_mode: 'forward', enabled: 1, custom_headers: '', ip_allow: '', ip_block: '', use_relay: 'off', ...overrides };
  const calls = [], pending = [], cacheReads = [], cacheWrites = [], audit = [];
  const DB = { prepare(sql) { return {
    args: [], bind(...args) { this.args=args;return this; },
    async first() {
      if (sql.includes("key = 'schema_init'")) return { value: edition === 'multi' ? 'multi-v6.8.5' : 'proxy-v6.4.8' };
      if (sql.startsWith('SELECT username FROM users')) return {username:'alice'};
      if (sql.startsWith('SELECT user_id FROM routes')) throw new Error('No legacy column');
      if (sql.startsWith('SELECT * FROM user_routes')) return this.args[0] === 'alice' && this.args[1] === route.prefix ? route : null;
      if (sql.startsWith('SELECT * FROM routes')) return this.args[0] === route.prefix ? route : null;
      return null;
    },
    async all() { return {results:sql==='SELECT key, value FROM settings'?Object.entries(rawSettings).map(([key,value])=>({key,value:String(value)})):[]}; },
    async run() { if(sql.startsWith('INSERT INTO audit_log'))audit.push(this.args);return {success:true}; },
  }; }, async batch() {return [];} };
  const env = { BASE_DOMAIN:'example.test', USER_DOMAIN:'example.test', DNS_RECORD_NAME:'proxy', DISABLE_DIRECT_PROXY:'1', DB };
  const ctx={waitUntil(p){pending.push(p);}};
  const originalFetch=globalThis.fetch, originalCaches=globalThis.caches;
  globalThis.caches={default:{async match(key){cacheReads.push(key.url);},async put(key){cacheWrites.push(key.url);}}};
  const request=(pathname,init={},host=edition==='multi'?'https://alice.example.test':'https://proxy.example.test')=>new Request(host+pathname,{...init,headers:{'cf-connecting-ip':'198.51.100.10',...init.headers}});
  const respond=handler=>{globalThis.fetch=async(input,init)=>{const req=input instanceof Request&&!init?input:new Request(input,init);calls.push(req);return handler(req);};};
  const serve=async req=>{const response=await module.default.fetch(req,env,ctx);await Promise.all(pending.splice(0));return response;};
  return {route,calls,pending,cacheReads,cacheWrites,audit,env,ctx,request,respond,serve,restore(){globalThis.fetch=originalFetch;globalThis.caches=originalCaches;}};
}
