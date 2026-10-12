import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('the farmer journey is confined to the homepage backdrop', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  const backdrop = read('src/components/HandPaintedFarmBackdrop.astro');
  assert.match(layout, /animateFarmer=\{bodyClass === 'home'\}/);
  assert.match(backdrop, /animateFarmer &&/);
  assert.match(backdrop, /farm-gardener\.webp/);
});

test('the farmer has separate desktop and mobile routes and respects reduced motion', () => {
  const css = read('src/styles/global.css');
  assert.match(css, /@keyframes farmer-harvest/);
  assert.match(css, /@keyframes farmer-pose[\s\S]*?rotate\(-15deg\)/);
  assert.match(css, /@keyframes farmer-mobile-walk/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.farm-journey/);
});
