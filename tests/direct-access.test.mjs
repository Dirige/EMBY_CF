import test from 'node:test';
import assert from 'node:assert/strict';
import { directProxyAllowed } from '../src/shared/http/validation.js';

test('raw-address proxy fails closed by default and with an empty allowlist', () => {
  for (const env of [{}, { DISABLE_DIRECT_PROXY: '0' }, { DIRECT_PROXY_ALLOW: 'media.test' }, { DISABLE_DIRECT_PROXY: '1', DIRECT_PROXY_ALLOW: 'media.test' }]) {
    assert.equal(directProxyAllowed(env, 'media.test'), false);
  }
});

test('raw-address proxy requires explicit opt-in, a matching domain boundary and a non-private literal', () => {
  const env = { DISABLE_DIRECT_PROXY: '0', DIRECT_PROXY_ALLOW: 'media.test,127.0.0.1' };
  assert.equal(directProxyAllowed(env, 'media.test'), true);
  assert.equal(directProxyAllowed(env, 'sub.media.test'), true);
  assert.equal(directProxyAllowed(env, 'evilmedia.test'), false);
  assert.equal(directProxyAllowed(env, 'media.test.evil.test'), false);
  assert.equal(directProxyAllowed(env, '127.0.0.1'), false);
});
