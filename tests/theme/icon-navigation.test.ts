import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('primary navigation uses labeled icons with hover text', () => {
  const source = readFileSync(new URL('../../src/components/SiteNav.astro', import.meta.url), 'utf8');
  for (const label of ['首页', '文章', '专题', '实用工具', '项目', '关于']) {
    assert.match(source, new RegExp(`label: '${label}'`));
  }
  assert.match(source, /aria-label=\{link\.label\}/);
  assert.match(source, /title=\{link\.label\}/);
  assert.match(source, /<link\.icon/);
  assert.doesNotMatch(source, /href=\{link\.href\}>\{link\.label\}<\/a>/);
});
