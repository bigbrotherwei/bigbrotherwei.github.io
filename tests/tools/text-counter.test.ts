import assert from 'node:assert/strict';
import test from 'node:test';
import { countText } from '../../src/lib/tools/text-counter.ts';

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
