import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArchiveGroups,
  buildTagIndex,
  findAdjacentPosts,
  findRelatedPosts,
  sortPostsByDate,
  toTagSlug,
} from '../../src/lib/content/discovery.ts';

const post = (id: string, date: string, tags: string[], topic = 'journal', draft = false) => ({
  id,
  data: {
    title: id,
    description: `${id} description`,
    pubDate: new Date(`${date}T00:00:00.000Z`),
    tags,
    topic,
    draft,
  },
});

test('normalizes Chinese and English labels into stable slugs', () => {
  assert.equal(toTagSlug(' GitHub  Pages '), 'github-pages');
  assert.equal(toTagSlug('博客重构'), '博客重构');
});

test('rejects distinct labels that collide after normalization', () => {
  assert.throws(() => buildTagIndex([
    post('one', '2026-09-01', ['GitHub Pages']),
    post('two', '2026-09-02', ['github   pages']),
  ]), /标签 slug 冲突/);
});

test('sorts equal dates deterministically and excludes drafts from archives', () => {
  const posts = [
    post('zeta', '2026-09-10', []),
    post('alpha', '2026-09-10', []),
    post('draft', '2026-10-01', [], 'journal', true),
  ];
  assert.deepEqual(sortPostsByDate(posts).map(({ id }) => id), ['alpha', 'zeta']);
  assert.deepEqual(buildArchiveGroups(posts).map(({ year }) => year), [2026]);
});

test('returns explicit older and newer neighbors at collection boundaries', () => {
  const posts = [post('new', '2026-09-03', []), post('middle', '2026-09-02', []), post('old', '2026-09-01', [])];
  assert.deepEqual(findAdjacentPosts(posts, 'middle'), { older: posts[2], newer: posts[0] });
  assert.equal(findAdjacentPosts(posts, 'new').newer, undefined);
  assert.equal(findAdjacentPosts([posts[0]], 'new').older, undefined);
});

test('ranks shared topic and tags while excluding current, draft, and zero-score posts', () => {
  const current = post('current', '2026-09-01', ['Astro'], 'build');
  const sameTopic = post('topic', '2026-08-01', [], 'build');
  const sameTag = post('tag', '2026-09-03', ['Astro'], 'other');
  const unrelated = post('none', '2026-09-04', ['CSS'], 'other');
  const draft = post('draft', '2026-09-05', ['Astro'], 'build', true);
  assert.deepEqual(findRelatedPosts([current, sameTag, unrelated, sameTopic, draft], current).map(({ id }) => id), ['topic', 'tag']);
});
