import test from 'node:test';
import assert from 'node:assert/strict';
import { multiRuntime, origin, passwordRecord, legacyCookie } from './multi-runtime-helpers.mjs';

// Synthetic data, but the pre-refactor table layout is the one found on fd.
const legacySchema = [
    `CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        salt TEXT NOT NULL, role TEXT DEFAULT 'user', status TEXT DEFAULT 'active', created_at TEXT DEFAULT '',
        subdomain TEXT NOT NULL DEFAULT '', route_limit INTEGER NOT NULL DEFAULT 20, last_login TEXT NOT NULL DEFAULT '')`,
    `CREATE TABLE user_routes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, prefix TEXT NOT NULL,
        target TEXT NOT NULL, remark TEXT DEFAULT '', target_latencies TEXT DEFAULT '', compat_mode TEXT DEFAULT 'off',
        last_play TEXT DEFAULT '', UNIQUE(user_id, prefix))`,
    `CREATE TABLE routes (id INTEGER PRIMARY KEY AUTOINCREMENT, prefix TEXT NOT NULL, target TEXT NOT NULL, remark TEXT DEFAULT '',
        last_play TEXT DEFAULT '', cache_img TEXT DEFAULT 'on', compat_mode TEXT DEFAULT 'off', sort_order INTEGER DEFAULT 0,
        target_latencies TEXT DEFAULT '', user_id INTEGER DEFAULT NULL, ip_mode TEXT DEFAULT 'forward', enabled INTEGER NOT NULL DEFAULT 1,
        custom_headers TEXT NOT NULL DEFAULT '', ip_allow TEXT NOT NULL DEFAULT '', ip_block TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL DEFAULT '')`,
    `CREATE TABLE admin_routes (prefix TEXT PRIMARY KEY, target TEXT NOT NULL, remark TEXT DEFAULT '', sort_order INTEGER DEFAULT 0,
        target_latencies TEXT DEFAULT '', compat_mode TEXT DEFAULT 'off', last_play TEXT DEFAULT '')`,
    `CREATE TABLE invite_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, status TEXT DEFAULT 'unused',
        used_by INTEGER, created_at TEXT DEFAULT '', used_at DATETIME DEFAULT NULL, max_uses INTEGER NOT NULL DEFAULT 1,
        used_count INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL DEFAULT '')`,
    'CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
    `CREATE TABLE optimized_domains (id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        is_builtin INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
];

test('multi/workerd: additive upgrade of legacy D1 preserves identities, hashes, invites, rows and inactive historical tables', { timeout: 60000 }, async t => {
    const calls = [];
    const f = await multiRuntime({ initialize: false, peers: true, outbound: request => { calls.push(request.url); return new Response('fixture'); } });
    const { mf, db, fetch, get, post, login } = f;
    try {
        await db.batch(legacySchema.map(sql => db.prepare(sql)));
        const pw = passwordRecord('synthetic-legacy-password');
        await db.batch([
            db.prepare("INSERT INTO users (id,username,password_hash,salt,subdomain) VALUES (1,'alice',?,?,'alice'),(2,'bob',?,?,'bob')").bind(pw.hash, pw.salt, pw.hash, pw.salt),
            db.prepare("INSERT INTO user_routes (id,user_id,prefix,target,remark,target_latencies,last_play) VALUES (17,1,'same','https://alice.test','Alice fixture','latency-preserved','old-play'),(18,2,'same','https://bob.test','Bob fixture','bob-latency','bob-play'),(19,999,'orphan','https://orphan.test','orphan','','')"),
            db.prepare("INSERT INTO routes (id,prefix,target,user_id,created_by) VALUES (23,'legacy','https://bob-legacy.test',2,'bob'),(24,'global','https://global.test',NULL,'admin')"),
            db.prepare("INSERT INTO admin_routes (prefix,target,remark) VALUES ('historical-only','https://must-not-activate.test','Preserve historical row')"),
            db.prepare("INSERT INTO invite_codes (id,code,status,note,created_by) VALUES (7,'SYNTHETIC-INVITE','unused','Preserve invite','admin')"),
            db.prepare("INSERT INTO optimized_domains (id,domain,name,is_builtin) VALUES (42,'keep.test','Preserve existing domain',0),(43,'www.visa.cn','Preserve historical builtin',1)"),
            db.prepare("INSERT INTO settings (key,value) VALUES ('route_owner_from_user_id_v1','1'),('last_report_date','2026-11-23')"),
        ]);
        const originals = new Map();
        for (const table of ['users', 'routes', 'user_routes', 'admin_routes', 'invite_codes', 'optimized_domains', 'settings']) {
            originals.set(table, (await db.prepare('SELECT * FROM ' + table).all()).results);
        }
        await t.test('schema initialization only adds compatibility columns/indexes and leaves original values intact', async () => {
            assert.equal((await fetch('/health')).status, 200);
            for (const [table, before] of originals) {
                const names = Object.keys(before[0]);
                const after = (await db.prepare('SELECT ' + names.join(',') + ' FROM ' + table).all()).results;
                if (table === 'settings') {
                    for (const row of before) assert.ok(after.some(value => value.key === row.key && value.value === row.value));
                } else assert.deepEqual(after, before, table);
            }
            const owners = (await db.prepare('SELECT id,user_id,owner FROM user_routes ORDER BY id').all()).results;
            assert.deepEqual(owners, [{ id: 17, user_id: 1, owner: 'alice' }, { id: 18, user_id: 2, owner: 'bob' }, { id: 19, user_id: 999, owner: '' }]);
            const peer = await mf.getWorker('peer');
            assert.equal((await peer.fetch(origin + '/health')).status, 200);
            assert.deepEqual((await db.prepare('SELECT id,user_id,owner FROM user_routes ORDER BY id').all()).results, owners);
        });
        const alice = legacyCookie(1), bob = legacyCookie(2), admin = legacyCookie(0, true);
        await t.test('old password hashes and cookies remain compatible, without resetting any password', async () => {
            assert.equal((await get('/api/user/me', alice)).status, 200);
            assert.equal((await get('/api/user/me', bob)).status, 200);
            assert.equal((await get('/admin/api/settings', admin)).status, 200);
            assert.equal((await login('alice', 'synthetic-legacy-password')).response.status, 200);
            for (const row of (await db.prepare('SELECT password_hash,salt FROM users').all()).results) assert.deepEqual(row, { password_hash: pw.hash, salt: pw.salt });
        });
        await t.test('same-prefix routes are selected by tenant; old routes(user_id) work, admin_routes stays inactive', async () => {
            calls.length = 0;
            assert.equal((await mf.dispatchFetch('https://alice.example.test/same/System/Ping')).status, 200);
            assert.equal((await mf.dispatchFetch('https://bob.example.test/same/System/Ping')).status, 200);
            assert.equal((await mf.dispatchFetch('https://bob.example.test/legacy/System/Ping')).status, 200);
            assert.deepEqual(calls, ['https://alice.test/System/Ping', 'https://bob.test/System/Ping', 'https://bob-legacy.test/System/Ping']);
            assert.equal((await fetch('/same/System/Ping')).status, 404);
            assert.equal((await fetch('/historical-only/System/Ping')).status, 404);
            assert.equal((await mf.dispatchFetch('https://alice.example.test/legacy/System/Ping')).status, 404);
            assert.equal(calls.length, 3);
        });
        await t.test('editing/renaming legacy user_routes preserves id, user_id and unknown fields, not a delete-and-recreate', async () => {
            const edit = { prefix: 'same', oldPrefix: 'same', target: 'https://updated.test', remark: 'Edited fixture', source: 'user' };
            assert.equal((await post('/api/user/routes', edit, alice)).status, 200);
            assert.equal((await post('/api/user/routes', { ...edit, prefix: 'renamed' }, alice)).status, 200);
            const row = await db.prepare('SELECT id,user_id,owner,prefix,target,target_latencies,last_play FROM user_routes WHERE id = 17').first();
            assert.deepEqual(row, { id: 17, user_id: 1, owner: 'alice', prefix: 'renamed', target: 'https://updated.test', target_latencies: 'latency-preserved', last_play: 'old-play' });
            const other = await db.prepare('SELECT * FROM user_routes WHERE id = 18').first(); assert.equal(other.target, 'https://bob.test');
            assert.equal((await post('/api/user/routes', { ...edit, oldPrefix: 'renamed', prefix: 'stolen', routeId: 17 }, bob)).status, 400);
            assert.equal((await db.prepare('SELECT prefix FROM user_routes WHERE id = 17').first()).prefix, 'renamed');
            const create = await post('/api/user/routes', { prefix: 'new', target: 'https://new.test' }, alice); assert.equal(create.status, 200);
            const added = await db.prepare("SELECT user_id,owner FROM user_routes WHERE prefix = 'new'").first();
            assert.deepEqual(added, { user_id: 1, owner: 'alice' });
            assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM user_routes WHERE id = 19').first()).n, 1);
        });
        await t.test('user CRUD/list counts and ordinary registration work on legacy NOT NULL/UNIQUE layouts', async () => {
            const routes = await get('/api/user/routes', alice).then(r => r.json());
            assert.ok(routes.some(r => r.prefix === 'renamed')); assert.ok(!routes.some(r => r.prefix === 'legacy'));
            const users = await get('/admin/api/users', admin).then(r => r.json());
            assert.equal(users.users.find(u => u.username === 'alice').routeCount, 2);
            assert.equal(users.users.find(u => u.username === 'bob').routeCount, 2);
            const registered = await post('/api/register', { username: 'charlie', password: 'synthetic-register-password', invite: 'SYNTHETIC-INVITE' });
            assert.equal(registered.status, 200);
            assert.equal((await db.prepare("SELECT used_count FROM invite_codes WHERE code = 'SYNTHETIC-INVITE'").first()).used_count, 1);
            assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM admin_routes WHERE prefix = 'historical-only'").first()).n, 1);
        });
    } finally { await mf.dispose(); }
});
