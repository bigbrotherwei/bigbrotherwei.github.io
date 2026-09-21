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

test('refuses to format or minify unsafe integer tokens without producing rewritten JSON', () => {
  const input = '{"id":9007199254740993}';

  for (const transform of [formatJson, minifyJson]) {
    const result = transform(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /安全整数/);
  }
});

test('keeps safe integers and numeric strings convertible', () => {
  assert.equal(formatJson('{"id":9007199254740991}').ok, true);
  assert.equal(minifyJson('{"id":"9007199254740993"}').ok, true);
  assert.equal(formatJson('{"note":"escaped \\"9007199254740993\\" value"}').ok, true);
});

test('refuses negative and scientific-notation unsafe integers', () => {
  for (const input of ['{"id":-9007199254740993}', '{"id":9.007199254740993e15}']) {
    const result = formatJson(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /安全整数/);
  }
});

test('refuses non-finite JSON numbers before stringifying them as null', () => {
  for (const transform of [formatJson, minifyJson]) {
    const result = transform('{"ratio":1e999}');
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /数值范围/);
  }
});

test('reports JSON syntax errors before checking unsafe number tokens', () => {
  const result = formatJson('{"id":9007199254740993,}');
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /JSON 无效/);
});

test('validates syntactically valid JSON with unsafe integers without transforming it', () => {
  assert.deepEqual(validateJson('{"id":9007199254740993}'), { ok: true, value: true });
});

test('rejects comments and trailing commas without replacing input', () => {
  const result = validateJson('{"ok": true,}');
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /JSON/);
});
