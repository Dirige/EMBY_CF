import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeResponseHeaders } from '../src/shared/http/responses.js';

test('response sanitizer removes hop-by-hop and named connection headers, not range/length validators', () => {
  const input = new Headers({ Connection: 'keep-alive, x-hop', 'X-Hop': 'private', 'Keep-Alive': 'timeout=5', 'Transfer-Encoding': 'chunked', 'Content-Length': '4', 'Content-Range': 'bytes 0-3/10', ETag: '"media"' });
  const output = sanitizeResponseHeaders(input);
  for (const name of ['Connection', 'X-Hop', 'Keep-Alive', 'Transfer-Encoding']) assert.equal(output.has(name), false);
  for (const name of ['Content-Length', 'Content-Range', 'ETag']) assert.equal(output.get(name), input.get(name));
});

test('response sanitizer preserves multiple independent cookies', () => {
  const input = new Headers();
  input.append('Set-Cookie', 'one=1; Path=/');
  input.append('Set-Cookie', 'two=2; Expires=Wed, 21 Oct 2037 07:28:00 GMT; Path=/');
  assert.deepEqual(sanitizeResponseHeaders(input).getSetCookie(), input.getSetCookie());
});
