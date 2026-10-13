import assert from 'node:assert/strict';
import test from 'node:test';
import { convertRadix } from '../../src/lib/tools/radix.ts';

test('converts among binary, octal, decimal, hexadecimal and base 36', () => {
  assert.deepEqual(convertRadix('101010', 2, 8), { ok: true, value: '52' });
  assert.deepEqual(convertRadix('52', 8, 10), { ok: true, value: '42' });
  assert.deepEqual(convertRadix('42', 10, 16), { ok: true, value: '2A' });
  assert.deepEqual(convertRadix('2a', 16, 36), { ok: true, value: '16' });
  assert.deepEqual(convertRadix('Z', 36, 10), { ok: true, value: '35' });
});

test('preserves negative values and normalizes zero', () => {
  assert.deepEqual(convertRadix('-ff', 16, 10), { ok: true, value: '-255' });
  assert.deepEqual(convertRadix('-0', 10, 2), { ok: true, value: '0' });
});

test('round-trips integers larger than Number.MAX_SAFE_INTEGER exactly', () => {
  assert.deepEqual(convertRadix('20000000000001', 16, 10), { ok: true, value: '9007199254740993' });
  assert.deepEqual(convertRadix('9007199254740993', 10, 16), { ok: true, value: '20000000000001' });
});

test('rejects unsupported bases and malformed integer input', () => {
  for (const [input, from, to] of [
    ['10', 1, 10], ['10', 10, 37], ['10', 2.5, 10],
    ['', 10, 2], ['  ', 10, 2], ['2', 2, 10], ['G', 16, 10],
    ['1.5', 10, 2], ['1e3', 10, 2], ['0x10', 16, 10], ['-', 10, 2],
  ] as const) {
    assert.equal(convertRadix(input, from, to).ok, false, `${input} ${from}->${to}`);
  }
});

test('accepts 256 digits but rejects a 257th digit', () => {
  assert.equal(convertRadix('1'.repeat(256), 2, 16).ok, true);
  assert.equal(convertRadix('1'.repeat(257), 2, 16).ok, false);
});
