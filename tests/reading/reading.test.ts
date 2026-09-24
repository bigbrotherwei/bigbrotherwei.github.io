import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateReadingProgress, findActiveHeadingId } from '../../src/lib/reading.ts';

test('reading progress follows the article body and clamps outside it', () => {
  assert.equal(calculateReadingProgress(100, 900, 0), 0);
  assert.equal(calculateReadingProgress(100, 900, 500), 50);
  assert.equal(calculateReadingProgress(100, 900, 1000), 100);
});

test('a short article reaches full progress when the reading marker passes it', () => {
  assert.equal(calculateReadingProgress(500, 500, 400), 0);
  assert.equal(calculateReadingProgress(500, 500, 500), 100);
});

test('the current section is the last heading above the reading cutoff', () => {
  const headings = [
    { id: 'first', top: -120 },
    { id: 'second', top: 85 },
    { id: 'third', top: 340 },
  ];

  assert.equal(findActiveHeadingId(headings, 100), 'second');
  assert.equal(findActiveHeadingId(headings, -200), 'first');
  assert.equal(findActiveHeadingId(headings, 500), 'third');
  assert.equal(findActiveHeadingId([], 100), null);
});
