import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEdition, fixture } from './helpers.mjs';

for (const edition of ['personal', 'multi']) {
  test(`${edition}/progress: anonymous viewers behind one IP are not collapsed`, async () => {
    const m = await loadEdition(edition), f = fixture(m, edition);
    try {
      f.respond(() => new Response(null, { status: 204 }));
      for (let i = 0; i < 2; i++) await m.proxyDirectUrl(f.request('/demo/Sessions/Playing/Progress', { method: 'POST' }), f.env, f.ctx, ['https://source.test/Sessions/Playing/Progress'], { enableCache: false });
      assert.equal(f.calls.length, 2);
    } finally { f.restore(); }
  });
  test(`${edition}/progress: dedupe is scoped to route and identifiable device`, async () => {
    const m = await loadEdition(edition), f = fixture(m, edition);
    try {
      f.respond(() => new Response(null, { status: 204 }));
      for (const prefix of ['one', 'one', 'two']) await m.proxyDirectUrl(f.request(`/${prefix}/Sessions/Playing/Progress?DeviceId=test-device`, { method: 'POST' }), f.env, f.ctx, ['https://source.test/Sessions/Playing/Progress'], { enableCache: false });
      assert.equal(f.calls.length, 2);
    } finally { f.restore(); }
  });
}
