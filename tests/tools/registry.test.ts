import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { toolCategories, tools } from '../../src/data/tools.ts';

test('publishes six uniquely addressable tools', () => {
  assert.equal(tools.length, 6);
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
