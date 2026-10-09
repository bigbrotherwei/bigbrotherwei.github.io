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

test('publishes ten uniquely addressable tools including regex', () => {
  assert.equal(tools.length, 10);
  assert.deepEqual(tools.map((tool) => tool.slug), [
    'images-pdf', 'markdown', 'text-diff', 'regex', 'json', 'base64',
    'url', 'timestamp', 'uuid', 'text-counter',
  ]);
  assert.equal(tools.find((tool) => tool.slug === 'markdown')?.href, '/tools/markdown/');
  assert.equal(tools.find((tool) => tool.slug === 'text-diff')?.href, '/tools/text-diff/');
  assert.equal(tools.find((tool) => tool.slug === 'regex')?.href, '/tools/regex/');
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
  ])), { text: 3, encoding: 2, time: 1, development: 3, file: 1 });
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
