import assert from 'node:assert/strict';
import test from 'node:test';
import { countText, shouldShowTextPerformanceNotice } from '../../src/lib/tools/text-counter.ts';

test('counts empty text without visible lines', () => {
  assert.deepEqual(countText(''), {
    characters: 0,
    charactersWithoutWhitespace: 0,
    chineseCharacters: 0,
    englishWords: 0,
    lines: 0,
    utf8Bytes: 0,
  });
});

test('does not count one terminal newline as another visible line', () => {
  assert.equal(countText('first\nsecond\n').lines, 2);
});

test('does not count a terminal CRLF as a visible line while keeping CRLF-separated lines', () => {
  assert.equal(countText('\r\n').lines, 0);
  assert.equal(countText('first\r\nsecond\r\n').lines, 2);
});

test('counts Chinese, alphanumeric words, emoji, and UTF-8 bytes', () => {
  assert.deepEqual(countText('你好 alpha42\n🌙'), {
    characters: 12,
    charactersWithoutWhitespace: 10,
    chineseCharacters: 2,
    englishWords: 1,
    lines: 2,
    utf8Bytes: 19,
  });
});

test('splits English word runs around adjacent Chinese characters', () => {
  assert.equal(countText('alpha你好beta').englishWords, 2);
});

test('warns only when text reaches the large-input threshold', () => {
  assert.equal(shouldShowTextPerformanceNotice(countText('a'.repeat(99_999))), false);
  assert.equal(shouldShowTextPerformanceNotice(countText('a'.repeat(100_000))), true);
  assert.equal(shouldShowTextPerformanceNotice(countText('🌙'.repeat(25_000))), true);
});
