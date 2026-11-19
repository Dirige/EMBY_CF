/** One-time semantic module organization after baseline extraction. */
import ts from 'typescript';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
async function walk(dir) {
  const result = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) result.push(...await walk(p)); else if (e.name.endsWith('.js')) result.push(p);
  }
  return result;
}
const files = await walk(path.join(root, 'src'));
const program = ts.createProgram(files, { allowJs: true, noLib: true, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.Latest, moduleResolution: ts.ModuleResolutionKind.Bundler });
const checker = program.getTypeChecker();
const items = [], owners = new Map();
const inNames = (name, list) => list.split(' ').includes(name);
function destination(name, original) {
  const base = original.includes('/shared/') ? 'src/shared' : original.slice(0, original.indexOf('/', 13));
  const edition = original.match(/src\/editions\/(personal|multi)/)?.[1];
  const ebase = edition ? `src/editions/${edition}` : base;
  if (inNames(name, 'SETTING_KEYS settingsCache XFO_CURRENT normalizeXfo getSettings setSetting')) return `${ebase}/config/settings.js`;
  if (inNames(name, 'getStatsHost getUserDomain zoneInfoCache zoneInfoCaches resolveZoneInfo invalidateZoneInfoCache')) return `${ebase}/integrations/zone.js`;
  if (name === 'auditLog') return 'src/shared/observability/audit.js';
  if (name === 'notify') return 'src/shared/integrations/notifications.js';
  if (inNames(name, 'cfGetAccountHttp workerHostCache getWorkerHosts makeHostMatcher cfGetZoneSummary cfGetZoneDailySeries cfGetAccountSummary cfGetAccountDailySeries cfGetWorkerSummary buildDailyReport sendDailyReport statsBuffer routeStatsBuffer userStatsBuffer statsBufferCount statsLastFlush')) return `${ebase}/integrations/analytics.js`;
  if (inNames(name, 'adminListUsers adminCreateUser adminUpdateUser adminDeleteUser adminResetData')) return `${ebase}/users/admin.js`;
  if (inNames(name, 'adminListInvites adminCreateInvite adminClearInvites adminDeleteInvite')) return `${ebase}/users/invites.js`;
  if (inNames(name, 'userEntryHost isValidIPv4 isValidDnsValue provisionUserDns userUpdateDns userEnsureDNS userDnsInfo')) return `${ebase}/users/dns.js`;
  if (inNames(name, 'routesHasUserIdCache routesHasUserId getUserLegacyRoutes getLegacyRouteForUser countUserRoutes userListRoutes userSaveRoute userDeleteRoute')) return `${ebase}/users/routes.js`;
  if (inNames(name, 'ownerCache clearOwnerCache resolveOwnerFromHost routeCache clearRouteCache getRoute getRouteCached validateUserPrefix resolveProxyTarget')) return `${ebase}/proxy/routes.js`;
  if (inNames(name, 'normalizeRelayBase relayPortFrom relayConfigCache RELAY_CACHE_TTL invalidateRelayCache getRelayConfig getRelayCfg hmacSha256Hex relayFetchHeaders')) return `${ebase}/relay/protocol.js`;
  if (inNames(name, 'getStreamTargetParts matchStreamTarget getStreamProxyLocation rewritePlaybackStreamUrls')) return `${ebase}/proxy/stream-targets.js`;
  if (inNames(name, 'CONFIG progressMap rateMap rateLimited hostDownUntil lastPlayTouched fallbackLogAt fallbackLogThrottled')) return `${ebase}/proxy/state.js`;
  if (original.endsWith('/ui/pages.js')) return `web/${edition}/pages.js`;
  return original;
}
for (const file of files) {
  const sf = program.getSourceFile(file), original = path.relative(root, file);
  for (const node of sf.statements) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isExportAssignment(node)) continue;
    const ids = ts.isVariableStatement(node) ? node.declarationList.declarations.map(d => d.name) : ts.isFunctionDeclaration(node) ? [node.name] : [];
    if (!ids.length || ids.some(n => !ts.isIdentifier(n))) throw new Error('Unsupported declaration ' + original);
    const names = ids.map(n => n.text), item = { node, sf, original, names, deps: new Map(), target: destination(names[0], original) };
    items.push(item);
    for (const id of ids) owners.set(checker.getSymbolAtLocation(id), item);
  }
}
for (const item of items) {
  const visit = node => {
    if (ts.isIdentifier(node)) {
      let symbol = checker.getSymbolAtLocation(node);
      if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      const owner = owners.get(symbol);
      if (owner && owner !== item) item.deps.set(node.text, owner);
    }
    ts.forEachChild(node, visit);
  };
  visit(item.node);
}
const output = new Map();
for (const item of items) {
  if (!output.has(item.target)) output.set(item.target, []);
  output.get(item.target).push(item);
}
for (const [target, group] of output) {
  const imports = new Map();
  for (const item of group) for (const [name, owner] of item.deps) if (owner.target !== target) {
    if (!imports.has(owner.target)) imports.set(owner.target, new Set());
    imports.get(owner.target).add(name);
  }
  const head = [...imports].map(([from, names]) => `import { ${[...names].sort().join(', ')} } from ${JSON.stringify('./' + path.relative(path.dirname(target), from))};`).join('\n');
  const exports = group.flatMap(i => i.names);
  await fs.mkdir(path.dirname(path.join(root, target)), { recursive: true });
  await fs.writeFile(path.join(root, target), `// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.\n${head}\n\n${group.map(i => i.node.getText(i.sf)).join('\n\n')}\n\nexport { ${exports.join(', ')} };\n${exports.includes('worker_default') ? 'export default worker_default;\n' : ''}`);
}
// Remove only extraction-created files which have been moved, never baseline files.
for (const file of files) if (!output.has(path.relative(root, file))) await fs.unlink(file);
await fs.writeFile(path.join(root, 'docs/MODULES.json'), JSON.stringify([...output].map(([file, group]) => ({ file, exports: group.flatMap(i => i.names) })), null, 2) + '\n');
console.log(`Organized ${items.length} declarations into ${output.size} domain modules.`);
