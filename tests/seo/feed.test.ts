import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRssItems } from '../../src/lib/feed.ts';

type FeedPost = {
  readonly id: string;
  readonly data: {
    readonly title: string;
    readonly description: string;
    readonly pubDate: Date;
    readonly tags: readonly string[];
    readonly draft: boolean;
  };
};

const post = (id: string, pubDate: string, draft: boolean, tags: readonly string[]): FeedPost => ({
  id,
  data: {
    title: `${id} title`,
    description: `${id} description`,
    pubDate: new Date(`${pubDate}T00:00:00.000Z`),
    tags,
    draft,
  },
});

test('builds newest-first RSS items from published posts', () => {
  const items = buildRssItems([
    post('older', '2026-09-01', false, ['Astro']),
    post('draft', '2026-09-03', true, ['Hidden']),
    post('newer', '2026-09-02', false, ['SEO', 'RSS']),
  ]);

  assert.deepEqual(items.map((item) => item.link), ['/posts/newer/', '/posts/older/']);
  assert.deepEqual(items[0]?.categories, ['SEO', 'RSS']);
  assert.deepEqual(items[0], {
    title: 'newer title',
    description: 'newer description',
    pubDate: new Date('2026-09-02T00:00:00.000Z'),
    link: '/posts/newer/',
    categories: ['SEO', 'RSS'],
  });
});
