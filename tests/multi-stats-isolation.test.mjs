import test from 'node:test';
import assert from 'node:assert/strict';
import { cfGetAccountSummary, cfGetAccountDailySeries, cfGetZoneSummary, cfGetZoneDailySeries, makeHostMatcher } from '../src/editions/multi/integrations/analytics.js';
import { getShanghaiParts } from '../src/shared/http/primitives.js';
import { multiRuntime, legacyCookie } from './multi-runtime-helpers.mjs';

const date = getShanghaiParts().dateKey;
const env = { BASE_DOMAIN: 'example.test', USER_DOMAIN: 'example.test', DNS_RECORD_NAME: 'proxy', CF_ZONE_ID: 'synthetic-zone', CF_ACCOUNT_ID: 'synthetic-account', CF_API_TOKEN: 'synthetic-cf-token' };
const row = (host, count) => ({ count, dimensions: { datetimeHour: date + 'T01:00:00Z', ...(host ? { clientRequestHTTPHost: host } : {}) }, sum: { edgeResponseBytes: count * 10, visits: count } });
const foreign = row('bob.example.test', 9000);
const scopedMethods = [
    ['account summary', hosts => cfGetAccountSummary(env, date, hosts)],
    ['account daily', hosts => cfGetAccountDailySeries(env, 7, hosts)],
    ['zone summary', hosts => cfGetZoneSummary(env, date, hosts)],
    ['zone daily', hosts => cfGetZoneDailySeries(env, 7, hosts)],
];

async function withGraphql(rows, callback, fail = false) {
    const previous = globalThis.fetch, calls = [];
    globalThis.fetch = async (input, init) => {
        const request = new Request(input, init);
        assert.equal(request.url, 'https://api.cloudflare.com/client/v4/graphql');
        const { query } = await request.json(); calls.push(query);
        if (fail) return Response.json({ errors: [{ message: 'Synthetic unsupported host dimension' }] });
        return Response.json({ data: { viewer: { accounts: [{ series: rows }], zones: [{ series: rows }] } } });
    };
    try { await callback(calls); } finally { globalThis.fetch = previous; }
}

test('multi stats: an explicit host set, including an empty set, never expands to sibling users or the base domain', () => {
    const match = makeHostMatcher(env, new Set(['ALICE.EXAMPLE.TEST:443']));
    assert.equal(match('alice.example.test'), true);
    assert.equal(match('Alice.Example.Test:443'), true);
    for (const host of ['bob.example.test', 'example.test', 'proxy.example.test', 'alice.example.test.attacker.test', '']) assert.equal(match(host), false);
    assert.equal(makeHostMatcher(env, new Set())('alice.example.test'), false);
});

for (const [name, call] of scopedMethods) {
    test(`multi stats ${name}: only requested hosts contribute; main-entry totals cannot escape the scope`, async () => {
        await withGraphql([row('Alice.Example.Test:443', 7), foreign, row('proxy.example.test', 100), row('unrelated.test', 90000)], async () => {
            const result = await call(new Set(['alice.example.test']));
            assert.ok(!result.error);
            if (result.series) {
                assert.equal(result.series.reduce((sum, day) => sum + day.requests, 0), 7);
                assert.equal(result.series.reduce((sum, day) => sum + day.traffic, 0), 70);
            } else {
                assert.equal(result.requests, 7); assert.equal(result.bytes, 70);
                assert.equal(result.mainRequests, 0); assert.equal(result.mainBytes, 0);
                if (result.byHost) assert.deepEqual(Object.keys(result.byHost), ['alice.example.test:443']);
            }
            const global = await call(new Set(['alice.example.test', 'proxy.example.test']));
            assert.ok(!global.error);
            assert.equal(global.series ? global.series.reduce((sum, day) => sum + day.requests, 0) : global.requests, 107);
        });
    });
    test(`multi stats ${name}: empty scope is rejected without any API query`, async () => {
        await withGraphql([foreign], async calls => {
            assert.ok((await call(new Set())).error);
            assert.equal(calls.length, 0);
        });
    });
    for (const failure of ['unmatched', 'missing-dimension', 'unsupported-dimension', 'truncated']) {
        test(`multi stats ${name}: ${failure} cannot fall back to account/zone totals`, async () => {
            const rows = failure === 'missing-dimension' ? [row('', 9000)]
                : failure === 'truncated' ? Array.from({ length: 10000 }, () => row('alice.example.test', 1)) : [foreign];
            await withGraphql(rows, async calls => {
                const result = await call(new Set(['alice.example.test']));
                assert.ok(result.error);
                assert.equal('requests' in result, false);
                assert.equal('bytes' in result, false);
                if (result.series) assert.deepEqual(result.series, []);
                assert.equal(calls.length, 1, 'A scoped query must not retry with account/zone totals');
            }, failure === 'unsupported-dimension');
        });
    }
}

test('multi/workerd stats: ordinary user D1 and CF totals stay scoped even when analytics cannot identify their host', { timeout: 30000 }, async t => {
    let failure = '', queries = [];
    const f = await multiRuntime({ bindings: env, outbound: async request => {
        assert.equal(request.url, 'https://api.cloudflare.com/client/v4/graphql');
        const { query } = await request.json(); queries.push(query);
        if (failure === 'unsupported-dimension') return Response.json({ errors: [{ message: 'Synthetic unsupported host dimension' }] });
        const rows = failure === 'truncated' ? Array.from({ length: 10000 }, () => row('alice.example.test', 1))
            : failure === 'missing-dimension' ? [row('', 9000)]
            : failure === 'unmatched' ? [foreign]
            : [row('alice.example.test', 7), foreign, row('proxy.example.test', 100), row('unrelated.test', 90000)];
        return Response.json({ data: { viewer: { accounts: [{ series: rows }] } } });
    } });
    try {
        await f.seedUser('alice', 1); await f.seedUser('bob', 2);
        await f.db.batch([
            f.db.prepare('INSERT INTO user_stats_hourly (owner,bucket_date,bucket_hour,request_count,play_count,playback_info_count,traffic_bytes) VALUES (?,?,1,7,2,4,70),(?,?,1,9000,9000,9000,90000)').bind('alice', date, 'bob', date),
            f.db.prepare('INSERT INTO route_stats_daily (prefix,bucket_date,request_count,traffic_bytes) VALUES (?,?,7,70),(?,?,9000,90000),(?,?,9000,90000)').bind('alice/demo', date, 'bob/demo', date, 'alice-other/demo', date),
        ]);
        await t.test('matching host produces only this user totals and never queries zone or Workers account summaries', async () => {
            const response = await f.get('/api/user/stats?date=' + date, legacyCookie(1));
            assert.equal(response.status, 200);
            const { data } = await response.json();
            assert.equal(data.scope, 'user'); assert.equal(data.owner, 'alice');
            assert.equal(data.todayRequests, 7); assert.equal(data.todayTrafficBytes, 70);
            assert.deepEqual(data.d1, { requests: 7, trafficBytes: 70, plays: 2, playbackInfo: 4 });
            assert.deepEqual(data.topRoutes, [{ prefix: 'demo', requests: 7, traffic: 70 }]);
            assert.equal(data.dailySeries.reduce((sum, day) => sum + day.requests, 0), 7);
            assert.equal(data.worker.requests, 0);
            assert.ok(queries.every(query => !/zones\(|workersInvocationsAdaptive/.test(query)));
        });
        for (failure of ['unmatched', 'missing-dimension', 'unsupported-dimension', 'truncated']) {
            await t.test(failure + ' is unavailable, not another user/account total', async () => {
                queries = [];
                const { data } = await f.get('/api/user/stats?date=' + date, legacyCookie(1)).then(r => r.json());
                assert.equal(data.statsSource, 'unavailable'); assert.equal(data.todayRequests, null); assert.equal(data.todayTrafficBytes, null);
                assert.equal(data.d1.requests, 7); assert.deepEqual(data.dailySeries, []);
                assert.equal(data.account.requests, undefined); assert.ok(data.account.error);
                assert.equal(queries.length, 1);
                assert.ok(!/bob|unrelated\.test|9000/.test(JSON.stringify(data)));
            });
        }
    } finally { await f.mf.dispose(); }
});
