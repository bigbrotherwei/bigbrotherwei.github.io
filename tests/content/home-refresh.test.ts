import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('home discovers published articles, an active topic, and real tools', () => {
  const home = read('src/pages/index.astro');
  assert.match(home, /getCollection\('posts'\)/);
  assert.match(home, /!post\.data\.draft/);
  assert.match(home, /getCollection\('topics'\)/);
  assert.match(home, /from '\.\.\/data\/tools'/);
  assert.doesNotMatch(home, /第二阶段先把入口铺好|后续逐步实现 JSON/);
});

test('GitHub link stays in the shared footer while site counters live in the home hero', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  const footer = read('src/components/SiteFooter.astro');
  const home = read('src/pages/index.astro');
  assert.match(layout, /<SiteFooter\s*\/>/);
  assert.doesNotMatch(footer, /<SiteStats\s*\/>/);
  assert.match(home, /<section class="home-hero">[\s\S]*?<SiteStats\s*\/>[\s\S]*?<section class="hero-content"/);
  assert.equal((home.match(/<SiteStats\s*\/>/g) ?? []).length, 1);
  assert.doesNotMatch(footer, /\/rss\.xml/);
  assert.match(footer, /github\.com\/bigbrotherwei/);
});

test('article dates and page views have their requested icons', () => {
  const date = read('src/components/PostDate.astro');
  const views = read('src/components/PageViews.astro');
  assert.match(date, /CalendarDays/);
  assert.match(views, /UsersRound/);
  assert.match(read('src/pages/posts/index.astro'), /<PostDate/);
  assert.match(read('src/pages/posts/[slug].astro'), /<PostDate/);
});

test('very narrow home viewports keep the site title inside the hero', () => {
  const home = read('src/pages/index.astro');
  assert.match(home, /@media \(max-width: 390px\)\s*\{\s*h1\s*\{\s*font-size: 2\.2rem;/);
});
