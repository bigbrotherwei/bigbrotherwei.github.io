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

test('GitHub link stays in the footer while site counters share the home navigation row', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  const footer = read('src/components/SiteFooter.astro');
  const home = read('src/pages/index.astro');
  const nav = read('src/components/SiteNav.astro');
  assert.match(layout, /<SiteFooter\s*\/>/);
  assert.doesNotMatch(footer, /<SiteStats\s*\/>/);
  assert.doesNotMatch(home, /<SiteStats\s*\/>/);
  assert.match(nav, /Astro\.url\.pathname === '\/' && <div class="site-nav__stats"><SiteStats\s*\/><\/div>/);
  assert.match(nav, /class="site-nav__stats"[\s\S]*?class="site-nav__links"/);
  assert.doesNotMatch(footer, /\/rss\.xml/);
  assert.match(footer, /github\.com\/bigbrotherwei/);
});

test('site statistics align with desktop navigation and avoid mobile icon overlap', () => {
  const css = read('src/styles/global.css');
  assert.match(css, /\.site-nav__stats\s*\{[^}]*align-self:\s*center/s);
  assert.match(css, /\.site-nav__stats \.site-stats\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.site-nav__stats\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?body\.home \.site-nav\s*\{[^}]*gap:\s*1\.25rem/);
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
