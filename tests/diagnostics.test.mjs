import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseRoute } from '../src/shared/observability/diagnostics.js';

test('diagnostics only probes configured targets, does not forward admin auth or disclose URLs', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async request => {
    calls.push(request);
    return Response.json({ Id: 'fixture', Version: '1.0' });
  };
  try {
    const data = await diagnoseRoute({ prefix: 'demo', target: 'https://configured.test/private-path?token=SECRET', enabled: 1 },
      new Request('https://proxy.test/admin/api/routes/diagnose?url=https://evil.test', { headers: { Cookie: 'ADMIN-SECRET', Authorization: 'ADMIN-TOKEN' } }), { edition: 'personal' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://configured.test/private-path/System/Info/Public?token=SECRET');
    assert.equal(calls[0].method, 'GET');
    assert.equal(calls[0].headers.has('Cookie'), false);
    assert.equal(calls[0].headers.has('Authorization'), false);
    assert.equal(data.results[0].ok, true);
    assert.equal(data.results[0].stage, 'verified');
    const text = JSON.stringify(data);
    for (const privateValue of ['configured.test', 'private-path', 'SECRET', 'ADMIN-TOKEN', 'evil.test']) assert.equal(text.includes(privateValue), false);
  } finally { globalThis.fetch = original; }
});

test('diagnostic tries the Emby prefix after 404, not the website root', async () => {
  const original = globalThis.fetch;
  const paths = [];
  globalThis.fetch = async request => {
    paths.push(new URL(request.url).pathname);
    return paths.length === 1 ? new Response(null, { status: 404 }) : Response.json({ Id: 'fixture', Version: '1.0' });
  };
  try {
    const data = await diagnoseRoute({ prefix: 'demo', target: 'https://configured.test/' }, new Request('https://proxy.test/admin'), { edition: 'personal' });
    assert.deepEqual(paths, ['/System/Info/Public', '/emby/System/Info/Public']);
    assert.equal(data.results[0].stage, 'verified');
    assert.equal(data.results[0].status, 200);
  } finally { globalThis.fetch = original; }
});

test('diagnostic distinguishes absent API, non-API 200 and upstream error', async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, stage] of [[404, 'endpoint-unavailable'], [200, 'unexpected-response'], [503, 'upstream']]) {
      const paths = [];
      globalThis.fetch = async request => {
        paths.push(new URL(request.url).pathname);
        return new Response('<html>generic page</html>', { status });
      };
      const data = await diagnoseRoute({ prefix: 'demo', target: 'https://configured.test/emby/' }, new Request('https://proxy.test/admin'), { edition: 'multi' });
      assert.deepEqual(paths, ['/emby/System/Info/Public']);
      assert.equal(data.results[0].ok, false);
      assert.equal(data.results[0].stage, stage);
    }
  } finally { globalThis.fetch = original; }
});

test('diagnostics has a bounded target count and sanitizes transport failures', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('private target https://secret.test/token=SECRET'); };
  try {
    const data = await diagnoseRoute({ prefix: 'demo', target: Array.from({ length: 20 }, (_, i) => `https://origin-${i}.test`).join(',') }, new Request('https://proxy.test/admin'), { edition: 'multi' });
    assert.equal(calls, 3);
    assert.equal(data.omittedTargets, 17);
    assert.equal(data.results.length, 3);
    assert.equal(JSON.stringify(data).includes('SECRET'), false);
  } finally { globalThis.fetch = original; }
});
