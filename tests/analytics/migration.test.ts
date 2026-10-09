import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (name: string) => readFileSync(path.join(root, name), 'utf8');

test('static pages use Vercount counters without an online placeholder', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  const home = read('src/components/SiteStats.astro');
  const article = read('src/pages/posts/[slug].astro');
  const tool = read('src/components/tools/ToolLayout.astro');
  assert.ok(existsSync(path.join(root, 'src/components/PageViews.astro')));
  const pageViews = read('src/components/PageViews.astro');
  assert.match(layout, /mountVercount\(document, window\)/);
  assert.doesNotMatch(layout, /mountAnalytics|PUBLIC_ANALYTICS_API_URL/);
  assert.match(home, /id="vercount_value_site_pv"/);
  assert.match(home, /id="vercount_value_site_uv"/);
  assert.match(pageViews, /id="vercount_value_page_pv"/);
  assert.match(article, /<PageViews label="阅读量"/);
  assert.match(tool, /<PageViews label="页面访问量"/);
  assert.doesNotMatch(tool, /使用次数|使用人数/);
  assert.doesNotMatch(home, /当前在线|data-stat-key/);
});

test('article and tool work surfaces use translucent outer panels while inputs stay solid', () => {
  const globalCss = read('src/styles/global.css');
  const toolsCss = read('src/styles/tools.css');
  assert.match(globalCss, /--color-panel-glass:\s*rgba\(/);
  assert.match(globalCss, /--color-reading-glass:\s*rgba\(/);
  assert.match(globalCss, /\.article-body\.sketch-card\s*\{[^}]*background:\s*var\(--color-reading-glass\)/s);
  assert.match(toolsCss, /\.tool-workspace\s*\{[^}]*background:\s*var\(--color-panel-glass\)/s);
  assert.match(toolsCss, /\.tool-field :where\(input, select, textarea\)\s*\{[^}]*background:\s*var\(--color-input\)/s);
});

test('dark theme glass reveals the scene instead of placing black panels over it', () => {
  const globalCss = read('src/styles/global.css');
  const toolsCss = read('src/styles/tools.css');
  const darkTheme = globalCss.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1] ?? '';
  assert.match(darkTheme, /--color-panel-glass:\s*rgba\(255, 250, 241, 0\.1[0-9]?\)/);
  assert.match(darkTheme, /--color-reading-glass:\s*rgba\(255, 250, 241, 0\.1[0-9]?\)/);
  assert.doesNotMatch(globalCss, /\.tool-page \.page-views\s*\{[^}]*background:\s*rgba\(8, 18, 31/s);
  assert.doesNotMatch(toolsCss, /\.tool-page > \.tool-status\s*\{[^}]*background:\s*rgba\(8, 18, 31/s);
  assert.doesNotMatch(toolsCss.match(/\.tool-workspace\s*\{([^}]+)\}/)?.[1] ?? '', /backdrop-filter/);
});

test('deployment and privacy copy describe only the active provider', () => {
  const workflow = read('.github/workflows/deploy.yml');
  const privacy = read('src/pages/privacy.astro');
  const guide = read('docs/analytics-setup.zh.md');
  assert.doesNotMatch(workflow, /verify-worker|PUBLIC_ANALYTICS_API_URL/);
  assert.match(privacy, /Vercount/);
  assert.match(privacy, /Cookie/);
  assert.doesNotMatch(privacy, /HMAC|心跳|当前在线”是/);
  assert.match(guide, /events\.vercount\.one\/js/);
  assert.doesNotMatch(guide, /wrangler|设置 Repository Variable `PUBLIC_ANALYTICS_API_URL`/);
});
