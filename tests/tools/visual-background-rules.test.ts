import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { pageBackgrounds } from '../../src/data/backgrounds.ts';
import { hasExplicitBackgroundKey } from '../../scripts/lib/visual-background-rules.mjs';

test('accepts a tool page only when it names its expected background key', () => {
  const source = '<BaseLayout backgroundKey="tool-json">';

  assert.equal(hasExplicitBackgroundKey(source, 'tool-json'), true);
  assert.equal(hasExplicitBackgroundKey(source, 'tool-base64'), false);
});

test('four new tools have eight distinct published background files', () => {
  const hashes = new Set<string>();
  for (const key of ['tool-images-pdf', 'tool-markdown', 'tool-text-diff', 'tool-regex'] as const) {
    for (const variant of ['desktop', 'mobile'] as const) {
      const asset = pageBackgrounds[key][variant];
      const file = new URL(`../../public${asset}`, import.meta.url);
      assert.ok(existsSync(file), `${key}.${variant} must exist`);
      hashes.add(createHash('sha256').update(readFileSync(file)).digest('hex'));
    }
  }
  assert.equal(hashes.size, 8);
});
