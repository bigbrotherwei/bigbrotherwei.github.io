import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const exists = (path: string) => existsSync(new URL(path, root));
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('project content is retained without publishing project pages', () => {
  assert.ok(exists('src/content/projects/bigbrotherwei-github-io.md'));
  assert.ok(!exists('src/pages/projects/index.astro'));
  assert.ok(!exists('src/pages/projects/[slug].astro'));
  assert.doesNotMatch(read('src/components/SiteNav.astro'), /href: '\/projects'/);
  assert.doesNotMatch(read('src/pages/search/index.astro'), /项目/);
});
