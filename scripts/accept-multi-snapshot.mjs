// Explicit offline acceptance only. Private Cloudflare/D1 snapshots are never
// imported into the repository, and every Worker outbound request is blocked.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import path from 'node:path';
import { Miniflare, Log } from 'miniflare';
import { root } from './build.mjs';

const snapshotDir = process.argv[2];
if (!snapshotDir || process.argv.length > 4) {
  console.error('Usage: node scripts/accept-multi-snapshot.mjs <private-fd-snapshot-directory> [multi-bundle-path]');
  process.exit(2);
}
const artifactDir = path.join(path.resolve(snapshotDir), 'isolated-acceptance-' + randomUUID());
await mkdir(artifactDir, { mode: 0o700 });
const reportPath = path.join(artifactDir, 'acceptance-private.json');
const report = { ok: false, started_at: new Date().toISOString(), checks: [], production_network_access: false };
const sha = data => createHash('sha256').update(data).digest('hex');
const quote = name => '"' + String(name).replaceAll('"', '""') + '"';
const fingerprint = rows => sha(JSON.stringify(rows.map(row => sha(JSON.stringify(Object.keys(row).sort().map(key => [key, row[key]])))).sort()));
function check(condition, label) {
  if (!condition) throw new Error(label);
  report.checks.push(label);
}
let mf, outboundAttempts = 0;
try {
  const names = ['before-live-version.json', 'before-live-schema-settings-private.json', 'before-live-all-tables-private.json', 'before-live-fd.mjs'];
  const inputs = await Promise.all(names.map(name => readFile(path.join(snapshotDir, name))));
  const initialHashes = inputs.map(sha);
  const version = JSON.parse(inputs[0]);
  const schemaResults = JSON.parse(inputs[1]);
  const tables = JSON.parse(inputs[2]);
  const database = version.resources.bindings.find(binding => binding.name === 'DB' && binding.type === 'd1');
  check((database?.id || database?.database_id) === 'bb606054-6e7b-45f4-ac36-a48216f102a9', 'Snapshot belongs to fd, not the personal database');
  const runtime = version.resources.script_runtime;
  check(runtime.compatibility_date === '2026-10-17' && !(runtime.compatibility_flags || []).length, 'Exact fd compatibility date and empty flags');
  const bindings = Object.fromEntries(version.resources.bindings.filter(binding => binding.type === 'plain_text').map(binding => [binding.name, binding.text]));
  const sessionRoot = String(bindings.SESSION_SECRET || bindings.ADMIN_TOKEN || '').trim();
  const rootPassword = String(bindings.ADMIN_TOKEN || '').trim();
  check(sessionRoot.length > 0 && rootPassword.length > 0, 'Original independent authentication bindings are present');
  const bundlePath = path.resolve(process.argv[3] || path.join(root, 'dist/multi.mjs'));
  const bundle = await readFile(bundlePath);
  report.bundle_sha256 = sha(bundle); report.bundle_bytes = bundle.length;
  report.baseline_version = version.id;
  const storage = path.join(artifactDir, 'd1-private');
  await mkdir(storage, { mode: 0o700 });
  const options = {
    modules: true, compatibilityDate: runtime.compatibility_date, compatibilityFlags: [], bindings,
    outboundService: () => { outboundAttempts++; return new Response('Blocked in isolated acceptance', { status: 503 }); },
  };
  mf = new Miniflare({
    host: '127.0.0.1', port: 0, log: new Log(0), d1Persist: storage,
    workers: [
      { name: 'default', ...options, script: bundle.toString(), d1Databases: { DB: 'isolated-fd-candidate' } },
      { name: 'peer', ...options, script: bundle.toString(), d1Databases: { DB: 'isolated-fd-candidate' } },
      { name: 'legacy', ...options, script: inputs[3].toString(), d1Databases: { DB: 'isolated-fd-baseline' } },
    ],
  });
  const db = await mf.getD1Database('DB');
  const legacyDb = await mf.getD1Database('DB', 'legacy');
  const tableNames = Object.keys(tables);
  const schemaObjects = schemaResults.flatMap(result => result.results || []).filter(row => row.sql && row.type && !String(row.name).startsWith('sqlite_'));
  // D1 creates its own _cf_KV system table and forbids recreating it through
  // the SQL API. The full snapshot contains every application table, not D1's
  // private runtime metadata; restore exactly that application schema.
  const runtimeManaged = schemaObjects.filter(row => row.type === 'table' && !tableNames.includes(row.name));
  check(runtimeManaged.every(row => String(row.name).startsWith('_cf_')), 'Only D1-managed metadata is outside the application snapshot');
  report.runtime_managed_tables = runtimeManaged.map(row => row.name);
  const schema = schemaObjects.filter(row => row.type !== 'table' || tableNames.includes(row.name));
  check(tableNames.includes('users') && tableNames.every(name => schema.some(row => row.type === 'table' && row.name === name)), 'Complete legacy application schema is available');
  report.original_tables = tableNames.length;
  report.original_rows = Object.values(tables).reduce((sum, result) => sum + (result.results || []).length, 0);
  async function restore(targetDb) {
    await targetDb.batch(schema.filter(row => row.type === 'table').map(row => targetDb.prepare(row.sql)));
    for (const [table, result] of Object.entries(tables)) {
      check(result.success && Array.isArray(result.results), 'Complete snapshot query: ' + table);
      for (let offset = 0; offset < result.results.length; offset += 40) {
        await targetDb.batch(result.results.slice(offset, offset + 40).map(row => {
          const columns = Object.keys(row);
          return targetDb.prepare('INSERT INTO ' + quote(table) + ' (' + columns.map(quote).join(',') + ') VALUES (' + columns.map(() => '?').join(',') + ')').bind(...columns.map(column => row[column]));
        }));
      }
    }
    const rest = schema.filter(row => row.type !== 'table');
    if (rest.length) await targetDb.batch(rest.map(row => targetDb.prepare(row.sql)));
  }
  await restore(db); await restore(legacyDb);
  const originalColumns = new Map();
  for (const table of tableNames) originalColumns.set(table, (await db.prepare('PRAGMA table_info(' + quote(table) + ')').all()).results);
  const originalIndexes = (await db.prepare("SELECT name,sql FROM sqlite_schema WHERE type = 'index' AND sql IS NOT NULL").all()).results;
  const origin = 'https://isolated-fd.example.test';
  const legacy = await mf.getWorker('legacy');
  const peer = await mf.getWorker('peer');
  const fetch = (url, init = {}) => mf.dispatchFetch(origin + url, { redirect: 'manual', ...init });
  const get = (url, cookie = '') => fetch(url, { headers: { Cookie: cookie } });
  const post = (url, data, cookie) => fetch(url, { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const cookie = (uid, twoParts = false) => {
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const message = twoParts ? 'session:' + expiry : 'session:' + uid + ':' + expiry;
    return 'admin_session=' + (twoParts ? expiry : uid + '.' + expiry) + '.' + createHmac('sha256', sessionRoot).update(message).digest('hex');
  };
  const adminCookie = cookie(0, true);
  check((await fetch('/health')).status === 200, 'Production candidate entry starts on the restored fd D1');
  for (const table of tableNames) {
    const columns = originalColumns.get(table);
    const afterColumns = (await db.prepare('PRAGMA table_info(' + quote(table) + ')').all()).results;
    check(columns.every(column => afterColumns.some(after => column.name === after.name && column.type === after.type && column.notnull === after.notnull && column.pk === after.pk)), 'Original column identities retained: ' + table);
    const after = (await db.prepare('SELECT ' + columns.map(column => quote(column.name)).join(',') + ' FROM ' + quote(table)).all()).results;
    if (table === 'settings') {
      check(tables[table].results.every(row => after.some(value => value.key === row.key && value.value === row.value)), 'All original settings retained; schema marker is additive');
    } else check(fingerprint(after) === fingerprint(tables[table].results), 'All original rows and values retained: ' + table);
  }
  const afterIndexes = (await db.prepare("SELECT name,sql FROM sqlite_schema WHERE type = 'index' AND sql IS NOT NULL").all()).results;
  check(originalIndexes.every(index => afterIndexes.some(after => index.name === after.name && index.sql === after.sql)), 'All original explicit indexes retained');
  const activeUsers = tables.users.results.filter(user => (user.status || 'active') === 'active');
  for (const user of activeUsers) {
    const session = cookie(user.id);
    const previous = await legacy.fetch(origin + '/api/user/me', { headers: { Cookie: session } });
    const current = await get('/api/user/me', session);
    check(previous.status === 200 && current.status === 200, 'Existing user session remains compatible in both production entries');
    const before = (await previous.json()).user, after = (await current.json()).user;
    check(before.id === after.id && before.username === after.username && before.role === after.role && before.subdomain === after.subdomain, 'Existing user identity, role and subdomain remain compatible');
    check((await peer.fetch(origin + '/api/user/me', { headers: { Cookie: session } })).status === 200, 'Existing session works in an independent candidate isolate');
  }
  report.compatible_active_users = activeUsers.length;
  check((await legacy.fetch(origin + '/admin/api/settings', { headers: { Cookie: adminCookie } })).status === 200, 'Original built-in administrator session works in the old entry');
  check((await get('/admin/api/settings', adminCookie)).status === 200, 'Original two-part administrator session works after upgrade');
  check((await get('/admin/api/settings')).status === 401 && (await get('/api/user/me')).status === 401, 'Unauthenticated administrator and user APIs stay protected');
  const notifications = await get('/admin/api/notifications', adminCookie).then(response => response.json());
  check(notifications.source === 'environment' && notifications.encryptionReady, 'Original fd SESSION_SECRET supports purpose-derived TG encryption without a new binding');
  const privateValues = [rootPassword, sessionRoot, bindings.CF_API_TOKEN, bindings.TELEGRAM_BOT_TOKEN].filter(value => typeof value === 'string' && value.length >= 8);
  for (const url of ['/admin/api/settings', '/admin/api/export', '/admin/api/relay']) {
    const response = await get(url, adminCookie);
    const text = await response.text();
    check(response.status === 200 && privateValues.every(value => !text.includes(value)), 'Private bindings are not exposed by ' + url);
  }
  const relay = await get('/admin/api/relay', adminCookie).then(response => response.json());
  check(relay.active === false && !relay.has_secret, 'Missing fd relay configuration remains disabled; no personal VPS is imported');
  for (const row of tables.admin_routes?.results || []) {
    check((await fetch('/' + encodeURIComponent(row.prefix) + '/System/Ping')).status === 404, 'Historical admin_routes remains inactive');
  }
  check(outboundAttempts === 0, 'Read-only upgrade acceptance makes no media, TG, DNS or CF API request');

  const user = activeUsers[0];
  if (user) {
    const session = cookie(user.id);
    const prefix = 'offline-fixture-' + randomUUID().slice(0, 8);
    check((await post('/api/user/routes', { prefix, target: 'https://synthetic-upstream.test', remark: 'Offline fixture' }, session)).status === 200, 'Legacy account can create a synthetic route on the old NOT NULL layout');
    const before = await db.prepare('SELECT * FROM user_routes WHERE owner = ? AND prefix = ?').bind(user.username, prefix).first();
    check(Number(before.user_id) === Number(user.id), 'Synthetic route retains legacy user_id ownership');
    check((await post('/api/user/routes', { prefix: prefix + '-renamed', oldPrefix: prefix, target: 'https://synthetic-upstream.test/updated', remark: 'Offline fixture' }, session)).status === 200, 'Legacy account can rename a synthetic route');
    const after = await db.prepare('SELECT * FROM user_routes WHERE owner = ? AND prefix = ?').bind(user.username, prefix + '-renamed').first();
    check(before.id === after.id && before.user_id === after.user_id && before.target_latencies === after.target_latencies, 'Rename preserves id, user_id and historical fields');
    check((await fetch('/api/user/routes?source=user&prefix=' + encodeURIComponent(prefix + '-renamed'), { method: 'DELETE', headers: { Cookie: session, Origin: origin } })).status === 200, 'Synthetic route cleanup succeeds without deleting original routes');
  }
  const token = '123456:synthetic-offline-token';
  check((await post('/admin/api/notifications', { token, chatId: '-100123456' }, adminCookie)).status === 200, 'TG configuration saves using the original fd bindings in the isolated copy');
  const encrypted = await db.prepare("SELECT value FROM multi_private WHERE key = 'telegram'").first();
  check(JSON.parse(encrypted.value).keySource === 'session' && !encrypted.value.includes(token), 'TG ciphertext is purpose-derived and contains no plaintext token');
  const nextPassword = 'synthetic-offline-new-admin-password';
  check((await post('/admin/api/security/password', { currentPassword: rootPassword, newPassword: nextPassword, confirmPassword: nextPassword }, adminCookie)).status === 200, 'Isolated built-in administrator can change their password');
  check((await get('/admin/api/settings', adminCookie)).status === 401 && (await peer.fetch(origin + '/admin/api/settings', { headers: { Cookie: adminCookie } })).status === 401, 'Administrator password change revokes old sessions across isolates');
  if (user) check((await get('/api/user/me', cookie(user.id))).status === 200, 'Administrator password change does not revoke the existing user');
  const login = await post('/admin/api/login', { username: 'admin', password: nextPassword });
  check(login.status === 200, 'New isolated administrator password can authenticate');
  const currentAdmin = login.headers.get('Set-Cookie').split(';')[0];
  if (user) {
    const reset = await fetch('/admin/api/users/' + user.id, { method: 'PUT', headers: { Cookie: currentAdmin, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'synthetic-offline-user-reset-password' }) });
    check(reset.status === 200, 'Isolated administrator reset works on the original users table');
    check((await get('/api/user/me', cookie(user.id))).status === 401 && (await peer.fetch(origin + '/api/user/me', { headers: { Cookie: cookie(user.id) } })).status === 401, 'User reset trigger revokes that account across isolates');
  }
  for (const table of ['invite_codes', 'admin_routes', 'optimized_domains', 'dns_records', 'dns_config', 'routes', 'user_routes']) {
    if (!tables[table]) continue;
    const columns = originalColumns.get(table);
    const rows = (await db.prepare('SELECT ' + columns.map(column => quote(column.name)).join(',') + ' FROM ' + quote(table)).all()).results;
    check(fingerprint(rows) === fingerprint(tables[table].results), 'Original configuration survives isolated feature tests: ' + table);
  }
  const finalHashes = await Promise.all(names.map(async name => sha(await readFile(path.join(snapshotDir, name)))));
  check(initialHashes.every((hash, index) => hash === finalHashes[index]), 'Private original snapshot files are unchanged');
  check(outboundAttempts === 0, 'All feature acceptance remained offline with no outbound requests');
  report.ok = true;
} catch (error) {
  // Detailed failures stay inside the protected directory, never in stdout.
  report.private_error = String(error?.stack || error);
  process.exitCode = 1;
} finally {
  if (mf) await mf.dispose();
  report.blocked_outbound_attempts = outboundAttempts;
  await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600, flag: 'wx' });
}
console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, original_tables: report.original_tables, original_rows: report.original_rows, blocked_outbound_attempts: outboundAttempts, bundle_sha256: report.bundle_sha256, private_report: reportPath }));
