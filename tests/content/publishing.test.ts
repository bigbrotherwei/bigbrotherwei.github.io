import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { checkPostPublishing } from '../../scripts/lib/post-publishing-checks.mjs';

const publicRoot = mkdtempSync(join(tmpdir(), 'blog-publishing-'));
after(() => rmSync(publicRoot, { recursive: true, force: true }));
mkdirSync(join(publicRoot, 'images'), { recursive: true });
writeFileSync(join(publicRoot, 'images', '有 空格.webp'), 'image');

const article = (body: string) => `---
title: "示例"
description: "摘要"
pubDate: 2026-10-09
tags: []
topic: "known"
order: 1
draft: false
background: "post-example"
---

${body}`;

const check = (posts: { file: string; source: string }[]) =>
  checkPostPublishing({ posts, topics: new Set(['known']), publicRoot });

test('unknown topic, duplicate order and duplicate slug identify article files', () => {
  const issues = check([
    { file: 'src/content/posts/first.md', source: article('Text') },
    { file: 'src/content/posts/second.md', source: article('Text') },
    { file: 'src/content/posts/first.mdx', source: article('Text').replace('topic: "known"', 'topic: "missing"') },
  ]);
  assert.ok(issues.some(({ file, message }) => file.endsWith('first.mdx') && /专题/.test(message)));
  assert.ok(issues.some(({ message }) => /order/.test(message)));
  assert.ok(issues.some(({ message }) => /slug/.test(message) && /first\.md/.test(message) && /first\.mdx/.test(message)));
});

test('Markdown images need alt and local media paths must exist', () => {
  const issues = check([{ file: 'src/content/posts/one.md', source: article('![](/images/missing.webp)\n\n<video src="/videos/missing.mp4" controls></video>') }]);
  assert.ok(issues.some(({ message }) => /替代文本/.test(message)));
  assert.ok(issues.some(({ message }) => /missing\.webp/.test(message)));
  assert.ok(issues.some(({ message }) => /missing\.mp4/.test(message)));
  assert.ok(issues.every(({ file }) => file.endsWith('one.md')));
});

test('encoded root-relative assets with query and hash resolve but remote links are not fetched', () => {
  const issues = check([{ file: 'src/content/posts/one.md', source: article('![说明](/images/%E6%9C%89%20%E7%A9%BA%E6%A0%BC.webp?v=1#top)\n\n[远程](https://example.invalid/nope)') }]);
  assert.deepEqual(issues, []);
});

test('MDX and raw HTML image/media attributes are checked without matching prose', () => {
  const issues = check([{ file: 'src/content/posts/one.mdx', source: article('正文里提到 /images/absent.webp，但它不是资源。\n\n<img src="/images/有%20空格.webp" alt="" />\n\n<source src="/videos/lost.mp4" />') }]);
  assert.ok(issues.some(({ message }) => /替代文本/.test(message)));
  assert.ok(issues.some(({ message }) => /lost\.mp4/.test(message)));
  assert.ok(!issues.some(({ message }) => /absent\.webp/.test(message)));
});

test('malformed frontmatter produces a diagnostic instead of crashing', () => {
  const issues = check([{ file: 'src/content/posts/broken.md', source: '---\ntitle: [broken\n---\nText' }]);
  assert.ok(issues.some(({ message }) => /frontmatter|YAML/i.test(message)));
});
