import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../src/pages/posts/index.astro', import.meta.url), 'utf8');

test('article index explains when no articles are published', () => {
  assert.match(source, /posts\.length > 0\s*\?/);
  assert.match(source, /还没有发布的文章。/);
});
