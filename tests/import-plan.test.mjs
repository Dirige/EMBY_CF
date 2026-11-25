import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImport } from '../src/shared/admin/import-plan.js';
import { readJson } from '../src/shared/admin/api.js';

test('import plan separates added/overwritten routes without returning target secrets', () => {
  const data = { routes: [{ prefix: 'new', target: 'https://source.test/SECRET' }, { prefix: 'demo', target: 'https://source.test/?token=SECRET' }], settings: { rate_limit_per_min: '10', arbitrary_secret: 'SECRET' } };
  const plan = inspectImport(data, ['demo'], ['rate_limit_per_min']);
  assert.deepEqual(plan.added, ['new']);
  assert.deepEqual(plan.overwritten, ['demo']);
  assert.deepEqual(plan.settings, ['rate_limit_per_min']);
  assert.equal(plan.canImport, true);
  assert.equal(JSON.stringify(plan).includes('SECRET'), false);
});

test('import preview rejects malformed and duplicate routes before any import', () => {
  const plan = inspectImport({ routes: [
    { prefix: 'demo', target: 'https://source.test' }, { prefix: 'demo', target: 'https://source.test' },
    { prefix: 'bad', target: 'file:///etc/passwd' }, { prefix: 'admin', target: 'https://source.test' },
    { prefix: 'badstream', target: 'https://source.test', stream_target: 'javascript:alert(1)' },
  ] }, [], []);
  assert.equal(plan.canImport, false);
  assert.equal(plan.invalid.length, 4);
  for (const data of [null, [], { routes: {} }, { settings: { domain_proxy_rules: '[]' } }]) assert.equal(inspectImport(data, [], []).success, false);
});

test('admin JSON reads are bounded by actual bytes and time, not Content-Length alone', async () => {
  assert.deepEqual(await readJson(new Request('https://proxy.test/', { method: 'POST', body: '{"ok":true}' })), { ok: true });
  assert.equal(await readJson(new Request('https://proxy.test/', { method: 'POST', body: 'x'.repeat(20) }), { limit: 10 }), null);
  let cancelled = false;
  const request = new Request('https://proxy.test/', { method: 'POST', body: new ReadableStream({ cancel() { cancelled = true; } }), duplex: 'half' });
  assert.equal(await readJson(request, { timeoutMs: 5 }), null);
  assert.equal(cancelled, true);
});
