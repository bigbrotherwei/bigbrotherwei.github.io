import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('posts collection loads Markdown and MDX with the same schema', () => {
  const config = read('src/content.config.ts');
  assert.match(config, /pattern:\s*['"]\*\*\/\*\.\(md\|mdx\)['"]/);
  assert.match(config, /const posts = defineCollection\([\s\S]*?schema: z\.object\(/);
  assert.match(read('astro.config.mjs'), /mdx\(\)/);
});

test('content verification accepts MDX and rejects duplicate Markdown/MDX slugs', () => {
  const verifier = read('scripts/verify-content.mjs');
  assert.match(verifier, /\.mdx/);
  assert.match(verifier, /duplicate|重复|冲突/i);
});

test('published post paths, search and RSS still exclude drafts regardless of source extension', () => {
  for (const path of ['src/pages/posts/[slug].astro', 'src/lib/feed.ts']) {
    assert.match(read(path), /!post\.data\.draft|post\.data\.draft\s*===\s*false/);
  }
  assert.match(read('src/pages/posts/[slug].astro'), /data-pagefind-body/);
});
