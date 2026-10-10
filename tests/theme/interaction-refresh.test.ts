import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('navigation icons expose visible hover labels without button frames', () => {
  const nav = read('src/components/SiteNav.astro');
  const css = read('src/styles/global.css');
  assert.match(nav, /data-tooltip=\{link\.label\}/);
  assert.match(nav, /data-tooltip="搜索"/);
  assert.match(nav, /data-tooltip="选择主题"/);
  assert.match(css, /\.site-nav__icon-link::after\s*\{[^}]*content:\s*attr\(data-tooltip\)/s);
  assert.match(css, /\.site-nav__icon-link\s*\{[^}]*border:\s*0/s);
});

test('footer keeps GitHub and counters but no other links or privacy prompts', () => {
  const footer = read('src/components/SiteFooter.astro');
  assert.match(footer, /github\.com\/bigbrotherwei/);
  assert.match(footer, /<SiteStats\s*\/>/);
  assert.doesNotMatch(footer, /href="\/(posts|topics|tools|about|rss\.xml)/);
  for (const path of ['src/components/SiteStats.astro', 'src/components/PageViews.astro', 'src/components/ArticleComments.astro']) {
    assert.doesNotMatch(read(path), /href="\/privacy\/"/, path);
  }
});

test('pointer decoration is mounted globally and honors reduced motion', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  assert.match(layout, /<PointerEffects\s*\/>/);
  assert.ok(existsSync(new URL('../../src/scripts/pointer-effects.ts', import.meta.url)));
  const effect = read('src/scripts/pointer-effects.ts');
  assert.match(effect, /prefers-reduced-motion: reduce/);
  assert.match(effect, /pointermove/);
  assert.match(effect, /pointerdown/);
  assert.match(effect, /requestAnimationFrame/);
  for (const fruit of ['watermelon', 'apple', 'banana', 'cabbage']) assert.match(effect, new RegExp(fruit));
});
