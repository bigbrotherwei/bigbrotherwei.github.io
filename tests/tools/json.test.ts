import assert from 'node:assert/strict';
import test from 'node:test';
import { formatJson, minifyJson, validateJson } from '../../src/lib/tools/json.ts';

test('formats valid JSON with two spaces', () => {
  assert.deepEqual(formatJson('{"name":"博客","items":[1,2]}'), {
    ok: true,
    value: '{\n  "name": "博客",\n  "items": [\n    1,\n    2\n  ]\n}',
  });
});

test('minifies valid JSON', () => {
  assert.deepEqual(minifyJson('{ "ok": true }'), { ok: true, value: '{"ok":true}' });
});

test('rejects comments and trailing commas without replacing input', () => {
  const result = validateJson('{"ok": true,}');
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /JSON/);
});
