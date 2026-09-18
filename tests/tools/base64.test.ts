import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeBase64, encodeBase64 } from '../../src/lib/tools/base64.ts';

test('round-trips Chinese and emoji as UTF-8', () => {
  const encoded = encodeBase64('博客🌙');

  assert.equal(encoded.ok, true);
  if (encoded.ok) assert.deepEqual(decodeBase64(encoded.value), { ok: true, value: '博客🌙' });
});

test('rejects malformed Base64', () => {
  const result = decodeBase64('%%%');

  assert.equal(result.ok, false);
});

test('rejects non-canonical Base64 padding and alphabet', () => {
  assert.equal(decodeBase64('A===').ok, false);
  assert.equal(decodeBase64('AB==').ok, false);
});

test('encodes and decodes an empty string', () => {
  assert.deepEqual(encodeBase64(''), { ok: true, value: '' });
  assert.deepEqual(decodeBase64(''), { ok: true, value: '' });
});
