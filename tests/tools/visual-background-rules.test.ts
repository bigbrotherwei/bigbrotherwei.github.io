import assert from 'node:assert/strict';
import test from 'node:test';
import { hasExplicitBackgroundKey } from '../../scripts/lib/visual-background-rules.mjs';

test('accepts a tool page only when it names its expected background key', () => {
  const source = '<BaseLayout backgroundKey="tool-json">';

  assert.equal(hasExplicitBackgroundKey(source, 'tool-json'), true);
  assert.equal(hasExplicitBackgroundKey(source, 'tool-base64'), false);
});
