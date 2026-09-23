import assert from 'node:assert/strict';
import test from 'node:test';
import { createSearchRequestGuard, toSearchViewResult } from '../../src/lib/search.ts';

test('maps a Pagefind record without interpreting its excerpt as HTML', () => {
  assert.deepEqual(toSearchViewResult({
    url: '/posts/hello/',
    plain_excerpt: '<b>plain text</b>',
    meta: { title: 'Hello', type: '文章' },
  }), {
    url: '/posts/hello/',
    title: 'Hello',
    type: '文章',
    excerpt: '<b>plain text</b>',
  });
});

test('uses readable fallbacks for blank Pagefind metadata', () => {
  assert.deepEqual(toSearchViewResult({
    url: '/topics/',
    plain_excerpt: '',
    meta: { title: '   ', type: '' },
  }), {
    url: '/topics/',
    title: '未命名内容',
    type: '内容',
    excerpt: '',
  });
});

test('rejects a Pagefind result outside the site root', () => {
  assert.throws(
    () => toSearchViewResult({
      url: 'https://example.com/posts/hello/',
      plain_excerpt: 'plain text',
      meta: { title: 'Hello', type: '文章' },
    }),
    /root-relative/u,
  );
});

test('only treats the newest search request as current', () => {
  const guard = createSearchRequestGuard();
  const first = guard.begin();
  const second = guard.begin();

  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});
