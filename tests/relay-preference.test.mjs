import assert from 'node:assert/strict';
import test from 'node:test';
import { relayRetryAllowed, relayResponseUsable } from '../src/editions/personal/relay/mode.js';
import { RELAY_PREFERENCE_MS, RELAY_RECOVERY_LEASE_MS, MAX_RELAY_PREFERENCES,
  relayPreferenceKey, markRelayPreferred, getRelayPreference, forgetRelayPreference,
  finishRelayProbe } from '../src/editions/personal/relay/preference.js';

test('relay retry policy: reads cover access blocks and transport failures; POST is narrowly bounded', () => {
  const login = new URL('https://api.test/emby/Users/AuthenticateByName');
  const playback = new URL('https://api.test/Items/test/PlaybackInfo');
  for (const status of [401, 403, 451, 502, 503, 504, 521, 522, 523, 524, 525, 526, 'transport']) {
    for (const method of ['GET', 'HEAD']) assert.equal(relayRetryAllowed(method, login, status), true);
    assert.equal(relayRetryAllowed('POST', login, status, true), [401, 403, 451].includes(status));
  }
  for (const status of [200, 301, 400, 404, 409, 429, 500]) assert.equal(relayRetryAllowed('GET', login, status), false);
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    assert.equal(relayRetryAllowed(method, new URL('https://api.test/Sessions/Playing/Progress'), 403, true), false);
  }
  assert.equal(relayRetryAllowed('POST', playback, 403, true), true);
  assert.equal(relayRetryAllowed('POST', playback, 403, false), false);
  assert.equal(relayRetryAllowed('POST', new URL(playback.href + '/Update'), 403, true), false);
});

test('relay response policy: real auth, concurrency, quota and gateway failures are not successful fallback', () => {
  for (const status of [401, 403, 451, 429, 500, 502, 503]) {
    assert.equal(relayResponseUsable(new Response(null, { status })), false);
  }
  assert.equal(relayResponseUsable(new Response(null, { headers: { 'X-Relay-Denied': 'quota' } })), false);
  for (const status of [200, 206, 302, 404, 416]) assert.equal(relayResponseUsable(new Response(null, { status })), true);
});

test('relay preference: two-minute cooldown, one read recovery lease, no speculative write probe', () => {
  const state = new Map();
  markRelayPreferred(state, 'route', 0);
  assert.equal(getRelayPreference(state, 'route', 'GET', RELAY_PREFERENCE_MS - 1).useRelay, true);
  assert.equal(getRelayPreference(state, 'route', 'POST', RELAY_PREFERENCE_MS).useRelay, true);
  const first = getRelayPreference(state, 'route', 'GET', RELAY_PREFERENCE_MS);
  assert.equal(first.useRelay, false);
  assert.ok(first.probe);
  assert.equal(getRelayPreference(state, 'route', 'HEAD', RELAY_PREFERENCE_MS + 1).useRelay, true);
  assert.equal(getRelayPreference(state, 'route', 'GET', RELAY_PREFERENCE_MS + RELAY_RECOVERY_LEASE_MS).useRelay, false);
  finishRelayProbe(state, 'route', first.probe, true);
  assert.equal(state.size, 0);
});

test('relay preference: stale probe/failure cannot clear a newer successful fallback', () => {
  const state = new Map();
  markRelayPreferred(state, 'route', 0);
  const old = getRelayPreference(state, 'route', 'GET', RELAY_PREFERENCE_MS);
  markRelayPreferred(state, 'route', RELAY_PREFERENCE_MS + 1);
  finishRelayProbe(state, 'route', old.probe, true);
  forgetRelayPreference(state, 'route', old.entry);
  assert.equal(state.size, 1);
  const current = getRelayPreference(state, 'route', 'GET', 2 * RELAY_PREFERENCE_MS + 1);
  finishRelayProbe(state, 'route', current.probe, false, 2 * RELAY_PREFERENCE_MS + 2);
  assert.equal(getRelayPreference(state, 'route', 'GET', 2 * RELAY_PREFERENCE_MS + 3).useRelay, true);
});

test('relay preference keys isolate route, host, origin, colo and country without storing credentials', () => {
  const request = (host, colo, country, query = '') => {
    const r = new Request(`https://${host}/demo/Items/test${query}`, { headers: { Authorization: 'synthetic-secret' } });
    Object.defineProperty(r, 'cf', { value: { colo, country } });
    return r;
  };
  const target = new URL('https://api.test/Videos/test/stream?ApiKey=synthetic-secret');
  const key = relayPreferenceKey(request('proxy.test', 'NRT', 'CN', '?ApiKey=synthetic-secret'), target, 'demo');
  assert.equal(key.includes('synthetic-secret'), false);
  assert.equal(key.includes('stream'), false);
  assert.equal(relayPreferenceKey(request('proxy.test', 'NRT', 'CN'), new URL('https://api.test/Users/Me'), 'demo'), key);
  for (const [host, colo, country, route, origin] of [
    ['other.test', 'NRT', 'CN', 'demo', target], ['proxy.test', 'SIN', 'CN', 'demo', target],
    ['proxy.test', 'NRT', 'SG', 'demo', target], ['proxy.test', 'NRT', 'CN', 'other', target],
    ['proxy.test', 'NRT', 'CN', 'demo', new URL('https://backup.test/')],
  ]) assert.notEqual(relayPreferenceKey(request(host, colo, country), origin, route), key);
});

test('relay preference metadata has a fixed entry bound', () => {
  const state = new Map();
  for (let i = 0; i < MAX_RELAY_PREFERENCES + 10; i++) markRelayPreferred(state, String(i), i);
  assert.equal(state.size, MAX_RELAY_PREFERENCES);
  assert.equal(state.has('0'), false);
  assert.equal(state.has(String(MAX_RELAY_PREFERENCES + 9)), true);
});
