import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { importMarkdownFile, renderMarkdown } from '../../src/lib/tools/markdown.ts';

const mib = 1024 * 1024;
const window = new JSDOM('').window as unknown as Window;

test('renders common Markdown structures and safe external links', () => {
  const result = renderMarkdown('# Heading\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1;\n```\n\n> Quote\n\n- Item\n\n[Site](https://example.com) ![Alt](https://example.com/p.png)', window);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const document = new JSDOM(result.value).window.document;
  assert.equal(document.querySelector('h1')?.textContent, 'Heading');
  assert.equal(document.querySelector('table td')?.textContent, '1');
  assert.match(document.querySelector('pre code')?.textContent ?? '', /const x = 1/);
  assert.equal(document.querySelector('blockquote')?.textContent?.trim(), 'Quote');
  assert.equal(document.querySelector('li')?.textContent, 'Item');
  const link = document.querySelector('a');
  assert.equal(link?.getAttribute('href'), 'https://example.com');
  assert.equal(link?.getAttribute('target'), '_blank');
  assert.match(link?.getAttribute('rel') ?? '', /noopener/);
  assert.match(link?.getAttribute('rel') ?? '', /noreferrer/);
  assert.equal(document.querySelector('img')?.getAttribute('src'), 'https://example.com/p.png');
});

test('removes executable HTML, event handlers and dangerous URLs', () => {
  const result = renderMarkdown('<script>window.pwned=1</script>\n<img src="x" onerror="window.pwned=2">\n<a href="javascript:alert(1)" onclick="alert(2)">bad</a>\n\n[also bad](javascript:alert(3))', window);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const document = new JSDOM(result.value).window.document;
  assert.equal(document.querySelector('script'), null);
  assert.equal(document.querySelector('[onerror], [onclick]'), null);
  assert.equal(document.querySelector('a[href^="javascript:"]'), null);
  assert.doesNotMatch(result.value, /window\.pwned|alert\(/);
});

test('enforces a UTF-8 limit of one MiB', () => {
  assert.equal(renderMarkdown('a'.repeat(mib), window).ok, true);
  const over = renderMarkdown('a'.repeat(mib + 1), window);
  assert.equal(over.ok, false);
  if (!over.ok) assert.match(over.error, /1 MiB/);
  assert.equal(renderMarkdown('中'.repeat(Math.floor(mib / 3) + 1), window).ok, false);
});

test('file import accepts .md and preserves the previous text on size or read errors', async () => {
  const ok = await importMarkdownFile({ name: 'note.md', size: 5, text: async () => '# New' });
  assert.deepEqual(ok, { ok: true, value: '# New' });
  const large = await importMarkdownFile({ name: 'large.md', size: mib + 1, text: async () => '# Wrong' });
  assert.equal(large.ok, false);
  const failed = await importMarkdownFile({ name: 'broken.md', size: 5, text: async () => { throw new Error('denied'); } });
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.match(failed.error, /broken\.md.*denied/s);
  const wrongType = await importMarkdownFile({ name: 'note.txt', size: 5, text: async () => '# Wrong' });
  assert.equal(wrongType.ok, false);
});
