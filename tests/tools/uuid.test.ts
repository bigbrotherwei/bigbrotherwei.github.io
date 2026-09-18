import assert from 'node:assert/strict';
import test from 'node:test';
import { generateUuids, normalizeUuidCount } from '../../src/lib/tools/uuid.ts';

test('rejects UUID counts outside one through twenty', () => {
  assert.equal(generateUuids(0, () => 'unused').ok, false);
  assert.equal(generateUuids(21, () => 'unused').ok, false);
});

test('generates one UUID with an injected generator', () => {
  assert.deepEqual(generateUuids(1, () => 'uuid-1'), { ok: true, value: ['uuid-1'] });
});

test('generates twenty UUIDs with an injected generator', () => {
  let sequence = 0;
  const result = generateUuids(20, () => `uuid-${++sequence}`);

  assert.deepEqual(result, {
    ok: true,
    value: Array.from({ length: 20 }, (_, index) => `uuid-${index + 1}`),
  });
});

test('reports unavailable secure UUID generation when no generator exists', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });

  try {
    assert.equal(generateUuids(1).ok, false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete (globalThis as { crypto?: Crypto }).crypto;
  }
});

test('normalizes UUID count with Number semantics before clamping', () => {
  assert.equal(normalizeUuidCount('1e2'), 20);
  assert.equal(normalizeUuidCount('3.8'), 3);
  assert.equal(normalizeUuidCount('not-a-number'), 1);
  assert.equal(normalizeUuidCount('Infinity'), 1);
});
