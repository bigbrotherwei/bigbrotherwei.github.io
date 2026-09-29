import assert from 'node:assert/strict';
import test from 'node:test';
import { parseThemePreference, resolveTheme } from '../../src/lib/theme.ts';

test('only supported stored preferences are accepted', () => {
  for (const preference of ['system', 'light', 'dark']) {
    assert.equal(parseThemePreference(preference), preference);
  }
  for (const value of [null, undefined, '', 'auto', 'LIGHT', 1, {}, false]) {
    assert.equal(parseThemePreference(value), 'system');
  }
});

test('system preference follows the system and explicit preferences override it', () => {
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('light', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('dark', true), 'dark');
});
