import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBlogPostingJsonLd,
  buildBreadcrumbJsonLd,
  buildCanonicalUrl,
  buildWebsiteJsonLd,
  serializeJsonLd,
} from '../../src/lib/seo.ts';
import type { JsonLdValue } from '../../src/lib/seo.ts';

test('removes query strings and hashes from canonical URLs', () => {
  assert.equal(
    buildCanonicalUrl('https://bigbrotherwei.github.io', '/posts/hello/?from=nav#title').href,
    'https://bigbrotherwei.github.io/posts/hello/',
  );
});

test('keeps the canonical home URL stable with a trailing slash', () => {
  assert.equal(buildCanonicalUrl('https://bigbrotherwei.github.io/', '/').href, 'https://bigbrotherwei.github.io/');
});

test('serializes JSON-LD without allowing script termination', () => {
  assert.equal(serializeJsonLd({ name: '</script><script>alert(1)</script>' }).includes('</script>'), false);
});

test('builds the website schema with the known site and author', () => {
  const website = buildWebsiteJsonLd({ site: 'https://bigbrotherwei.github.io' });
  const value: JsonLdValue = website;

  assert.ok(value);
  assert.equal(website['@type'], 'WebSite');
  assert.equal(website.name, 'bigbrotherwei');
  assert.equal(website.inLanguage, 'zh-CN');
  assert.equal(website.url, 'https://bigbrotherwei.github.io/');
  assert.equal(website.author.name, 'bigbrotherwei');
  assert.equal(website.author.url, 'https://github.com/bigbrotherwei');
});

test('builds a blog posting schema with canonical content fields', () => {
  const posting = buildBlogPostingJsonLd({
    site: 'https://bigbrotherwei.github.io',
    path: '/posts/hello/',
    title: 'Hello',
    description: 'Description',
    publishedAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    tags: ['Astro', 'SEO'],
    imagePath: '/images/backgrounds/post.webp',
  });
  const value: JsonLdValue = posting;

  assert.ok(value);
  assert.equal(posting['@type'], 'BlogPosting');
  assert.equal(posting.mainEntityOfPage, 'https://bigbrotherwei.github.io/posts/hello/');
  assert.deepEqual(posting.keywords, ['Astro', 'SEO']);
  assert.equal(posting.author.name, 'bigbrotherwei');
  assert.equal(posting.image, 'https://bigbrotherwei.github.io/images/backgrounds/post.webp');
  assert.equal(posting.datePublished, '2026-09-01T00:00:00.000Z');
  assert.equal(posting.dateModified, '2026-09-02T00:00:00.000Z');
});

test('builds breadcrumbs with absolute URLs and one-based positions', () => {
  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: '首页', path: '/' },
    { name: '文章', path: '/posts/' },
    { name: 'Hello', path: '/posts/hello/' },
  ], 'https://bigbrotherwei.github.io');
  const value: JsonLdValue = breadcrumbs;

  assert.ok(value);
  assert.deepEqual(breadcrumbs.itemListElement.map((item) => item.position), [1, 2, 3]);
  assert.deepEqual(breadcrumbs.itemListElement.map((item) => item.item), [
    'https://bigbrotherwei.github.io/',
    'https://bigbrotherwei.github.io/posts/',
    'https://bigbrotherwei.github.io/posts/hello/',
  ]);
});
