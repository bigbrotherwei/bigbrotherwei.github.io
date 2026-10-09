import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (name: string) => readFileSync(path.join(root, name), 'utf8');

test('static pages use Vercount counters without an online placeholder', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  const home = read('src/components/SiteStats.astro');
  const article = read('src/components/ArticleReads.astro');
  assert.match(layout, /mountVercount\(document, window\)/);
  assert.doesNotMatch(layout, /mountAnalytics|PUBLIC_ANALYTICS_API_URL/);
  assert.match(home, /id="vercount_value_site_pv"/);
  assert.match(home, /id="vercount_value_site_uv"/);
  assert.match(article, /id="vercount_value_page_pv"/);
  assert.doesNotMatch(home, /当前在线|data-stat-key/);
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
