import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { toolCategories, tools } from '../../src/data/tools.ts';

test('publishes twelve uniquely addressable tools including SHA', () => {
  assert.equal(tools.length, 12);
  assert.deepEqual(tools.map((tool) => tool.slug), [
    'images-pdf', 'markdown', 'text-diff', 'regex', 'json', 'base64',
    'url', 'radix', 'sha', 'timestamp', 'uuid', 'text-counter',
  ]);
  assert.equal(tools.find((tool) => tool.slug === 'markdown')?.href, '/tools/markdown/');
  assert.equal(tools.find((tool) => tool.slug === 'text-diff')?.href, '/tools/text-diff/');
  assert.equal(tools.find((tool) => tool.slug === 'regex')?.href, '/tools/regex/');
  assert.equal(tools.find((tool) => tool.slug === 'radix')?.href, '/tools/radix/');
  assert.equal(tools.find((tool) => tool.slug === 'sha')?.href, '/tools/sha/');
  assert.equal(new Set(tools.map((tool) => tool.slug)).size, tools.length);

  for (const tool of tools) {
    assert.equal(tool.href, `/tools/${tool.slug}/`);
  }
});

test('assigns every tool to a registered category and unique future background key', () => {
  const categoryValues = new Set(toolCategories.filter((category) => category.value !== 'all').map((category) => category.value));

  for (const tool of tools) {
    assert.ok(categoryValues.has(tool.category));
  }

  assert.equal(new Set(tools.map((tool) => tool.backgroundKey)).size, tools.length);
  assert.deepEqual(Object.fromEntries([...categoryValues].map((category) => [
    category, tools.filter((tool) => tool.category === category).length,
  ])), { text: 3, encoding: 3, time: 1, development: 4, file: 1 });
});

test('route verification rejects a registry route that has no page even when legacy routes remain', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'tool-verifier-'));
  const toolDirectory = join(fixtureRoot, 'src/pages/tools');
  const verifierPath = new URL('../../scripts/verify-tools.mjs', import.meta.url);

  try {
    mkdirSync(join(fixtureRoot, 'src/data'), { recursive: true });
    mkdirSync(toolDirectory, { recursive: true });
    writeFileSync(
      join(fixtureRoot, 'src/data/tools.ts'),
      "export const tools = [{ slug: 'missing', href: '/tools/missing/', backgroundKey: 'tool-missing' }];\n",
    );
    writeFileSync(
      join(toolDirectory, 'index.astro'),
      "import { tools, toolCategories } from '../../data/tools';\n<data-tool-card data-search data-category-filter data-empty-state data-result-count aria-live />\n",
    );

    for (const slug of ['json', 'base64', 'url', 'timestamp', 'uuid', 'text-counter']) {
      writeFileSync(join(toolDirectory, `${slug}.astro`), 'legacy route\n');
    }

    const result = spawnSync(process.execPath, ['--experimental-strip-types', fileURLToPath(verifierPath)], {
      cwd: fixtureRoot,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(`${result.stdout}${result.stderr}`, /Missing tool route: src\/pages\/tools\/missing\.astro/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('keeps hidden tool cards visually removed even when card classes set display', () => {
  const globalCss = readFileSync(new URL('../../src/styles/global.css', import.meta.url), 'utf8');

  assert.match(globalCss, /\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important\s*;/s);
});

test('new tool status messages stay inside their work panels', () => {
  for (const slug of ['images-pdf', 'markdown', 'text-diff', 'regex']) {
    const page = readFileSync(new URL(`../../src/pages/tools/${slug}.astro`, import.meta.url), 'utf8');
    assert.match(page, /<ToolLayout\b[^>]*\bstatusInside\b/s, `${slug} should place status inside the workspace`);
  }
});

test('directory search and category filters update the visible count together', () => {
  const source = readFileSync(new URL('../../src/pages/tools/index.astro', import.meta.url), 'utf8');
  const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'tool directory needs a client filter script');
  const body = `
    <input id="tool-search" type="search">
    ${toolCategories.map((category) => `<button data-category-filter="${category.value}" aria-pressed="${category.value === 'all'}"></button>`).join('')}
    ${tools.map((tool) => `<a data-tool-card data-category="${tool.category}" data-search="${tool.title} ${tool.searchTerms}"></a>`).join('')}
    <p data-result-count></p><p data-empty-state hidden></p>`;
  const dom = new JSDOM(body, { runScripts: 'outside-only' });
  try {
    dom.window.eval(ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);
    const search = dom.window.document.querySelector<HTMLInputElement>('#tool-search')!;
    const fileFilter = dom.window.document.querySelector<HTMLButtonElement>('[data-category-filter="file"]')!;
    const count = dom.window.document.querySelector<HTMLElement>('[data-result-count]')!;
    const empty = dom.window.document.querySelector<HTMLElement>('[data-empty-state]')!;

    fileFilter.click();
    assert.equal(count.textContent, '已显示 1 个工具。');
    assert.equal(dom.window.document.querySelectorAll('[data-tool-card]:not([hidden])').length, 1);
    assert.equal(fileFilter.getAttribute('aria-pressed'), 'true');

    search.value = 'markdown';
    search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(count.textContent, '已显示 0 个工具。');
    assert.equal(empty.hidden, false);

    dom.window.document.querySelector<HTMLButtonElement>('[data-category-filter="all"]')!.click();
    assert.equal(count.textContent, '已显示 1 个工具。');
    assert.equal(empty.hidden, true);
  } finally {
    dom.window.close();
  }
});

test('directory hides empty groups and restores the active category after clearing search', () => {
  const source = readFileSync(new URL('../../src/pages/tools/index.astro', import.meta.url), 'utf8');
  const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const dom = new JSDOM(`
    <input id="tool-search" type="search">
    <button data-category-filter="all" aria-pressed="true"></button>
    <button data-category-filter="text" aria-pressed="false"></button>
    <button data-category-filter="encoding" aria-pressed="false"></button>
    <section data-tool-group data-category="text"><a data-tool-card data-category="text" data-search="Markdown preview"></a></section>
    <section data-tool-group data-category="encoding"><a data-tool-card data-category="encoding" data-search="Base64 converter"></a></section>
    <p data-result-count>已显示 2 个工具。</p><p data-empty-state hidden></p>
  `, { runScripts: 'outside-only' });
  try {
    const document = dom.window.document;
    const search = document.querySelector<HTMLInputElement>('#tool-search')!;
    const groups = Array.from(document.querySelectorAll<HTMLElement>('[data-tool-group]'));
    const count = document.querySelector<HTMLElement>('[data-result-count]')!;
    const empty = document.querySelector<HTMLElement>('[data-empty-state]')!;
    assert.deepEqual(groups.map((group) => group.hidden), [false, false]);
    dom.window.eval(ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);

    search.value = 'markdown';
    search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.deepEqual(groups.map((group) => group.hidden), [false, true]);
    assert.equal(count.textContent, '已显示 1 个工具。');

    document.querySelector<HTMLButtonElement>('[data-category-filter="encoding"]')!.click();
    assert.deepEqual(groups.map((group) => group.hidden), [true, true]);
    assert.equal(count.textContent, '已显示 0 个工具。');
    assert.equal(empty.hidden, false);

    search.value = '';
    search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.deepEqual(groups.map((group) => group.hidden), [true, false]);
    assert.equal(count.textContent, '已显示 1 个工具。');
    assert.equal(empty.hidden, true);
  } finally {
    dom.window.close();
  }
});
