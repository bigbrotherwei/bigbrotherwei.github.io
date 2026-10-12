import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('the moonlit farm scene replaces the walking farmer only on the homepage', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  const backdrop = read('src/components/HandPaintedFarmBackdrop.astro');
  assert.match(layout, /animateFarmNight=\{bodyClass === 'home'\}/);
  assert.match(backdrop, /animateFarmNight &&/);
  assert.match(backdrop, /farm-night__moon/);
  assert.match(backdrop, /farm-night__couple/);
  assert.match(backdrop, /farm-night__fairy/);
  assert.match(backdrop, /farm-night__droplet/);
  assert.doesNotMatch(backdrop, /farm-gardener\.webp|farm-journey/);
});

test('the night scene has small motions, mobile placement and reduced-motion behavior', () => {
  const css = read('src/styles/global.css');
  assert.match(css, /@keyframes couple-breathe/);
  assert.match(css, /@keyframes fairy-hover/);
  assert.match(css, /@keyframes water-drop/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.farm-night__couple/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.farm-night__fairy/);
  assert.doesNotMatch(css, /@keyframes farmer-harvest|@keyframes farmer-mobile-walk/);
});
