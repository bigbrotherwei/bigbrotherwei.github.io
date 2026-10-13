import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { lazyArticleImages } from '../../scripts/lazy-article-images.mjs';

async function applyImagePlugin(image: { properties: Record<string, unknown> }) {
  await lazyArticleImages.element.visit(image, {
    setProperty(node: { properties: Record<string, unknown> }, key: string, value: unknown) {
      node.properties[key] = value;
    },
  });
}

test('local article images load lazily with intrinsic dimensions', async () => {
  const image: { type: string; tagName: string; properties: Record<string, unknown>; children: unknown[] } = {
    type: 'element',
    tagName: 'img',
    properties: { src: '/images/posts/foundationdb-architecture/figure-1.png', alt: '架构图' },
    children: [],
  };
  await applyImagePlugin(image);

  assert.equal(image.properties.loading, 'lazy');
  assert.equal(image.properties.decoding, 'async');
  assert.equal(image.properties.width, 2195);
  assert.equal(image.properties.height, 1125);
});

test('explicit image loading choices are preserved', async () => {
  const image: { type: string; tagName: string; properties: Record<string, unknown>; children: unknown[] } = {
    type: 'element',
    tagName: 'img',
    properties: { src: 'https://example.com/hero.png', loading: 'eager', decoding: 'sync' },
    children: [],
  };
  await applyImagePlugin(image);

  assert.equal(image.properties.loading, 'eager');
  assert.equal(image.properties.decoding, 'sync');
  assert.equal(image.properties.width, undefined);
});

test('Astro applies article image loading during content rendering', () => {
  const config = readFileSync(new URL('../../astro.config.mjs', import.meta.url), 'utf8');
  assert.match(config, /processor:\s*satteri\(\{ hastPlugins:\s*\[lazyArticleImages\] \}\)/);
});
