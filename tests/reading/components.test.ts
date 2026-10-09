import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const source = (name: string) => {
  const url = new URL(`../../src/components/article/${name}.astro`, import.meta.url);
  assert.ok(existsSync(url), `${name}.astro should exist`);
  return readFileSync(url, 'utf8');
};

test('callouts expose only the three semantic variants and a readable label', () => {
  const component = source('Callout');
  assert.match(component, /'info'\s*\|\s*'tip'\s*\|\s*'warning'/);
  assert.match(component, /说明/);
  assert.match(component, /提示/);
  assert.match(component, /注意/);
  assert.match(component, /<slot\s*\/>/);
});

test('gallery requires alternative text and renders images with optional captions', () => {
  const component = source('Gallery');
  assert.match(component, /alt\.trim\(\)/);
  assert.match(component, /<figure/);
  assert.match(component, /<img/);
  assert.match(component, /<figcaption/);
});

test('disclosure uses native details and summary', () => {
  const component = source('Disclosure');
  assert.match(component, /<details/);
  assert.match(component, /<summary/);
  assert.match(component, /<slot\s*\/>/);
});

test('article components have responsive and theme-token styles', () => {
  const stylesheet = readFileSync(new URL('../../src/styles/global.css', import.meta.url), 'utf8');
  assert.match(stylesheet, /\.article-callout/);
  assert.match(stylesheet, /\.article-gallery/);
  assert.match(stylesheet, /\.article-disclosure/);
  assert.match(stylesheet, /grid-template-columns:\s*repeat\(auto-fit/);
  assert.match(stylesheet, /var\(--color-panel/);
});
