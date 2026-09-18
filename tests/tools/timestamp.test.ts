import assert from 'node:assert/strict';
import test from 'node:test';
import { convertTimestamp } from '../../src/lib/tools/timestamp.ts';

test('converts a 10-digit timestamp as seconds in auto mode', () => {
  assert.deepEqual(convertTimestamp('1704067200', 'auto'), {
    ok: true,
    value: {
      milliseconds: 1704067200000,
      seconds: 1704067200,
      local: new Date(1704067200000).toLocaleString(),
      iso: '2024-01-01T00:00:00.000Z',
    },
  });
});

test('converts a 13-digit timestamp as milliseconds in auto mode', () => {
  const result = convertTimestamp('1704067200123', 'auto');

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.milliseconds, 1704067200123);
    assert.equal(result.value.seconds, 1704067200.123);
    assert.equal(result.value.iso, '2024-01-01T00:00:00.123Z');
  }
});

test('uses the explicitly selected timestamp unit', () => {
  const result = convertTimestamp('1704067200', 'milliseconds');

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.iso, '1970-01-20T17:21:07.200Z');
});

test('rejects non-numeric and out-of-range timestamps', () => {
  assert.equal(convertTimestamp('not-a-number', 'auto').ok, false);
  assert.equal(convertTimestamp('8640000000000001', 'milliseconds').ok, false);
});
