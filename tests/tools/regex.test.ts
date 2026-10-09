import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { runRegex, renderRegexResults, summarizeRegexResults } from '../../src/lib/tools/regex.ts';

test('reports syntax and unsupported flags', () => {
  for (const [pattern, flags] of [['(', 'g'], ['a', 'x'], ['a', 'gg']]) {
    const result = runRegex(pattern, flags, 'abc');
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /表达式|标志/);
  }
});

test('accepts exact length limits and rejects the next character', () => {
  assert.equal(runRegex('a'.repeat(500), '', '').ok, true);
  assert.equal(runRegex('', '', 'a'.repeat(100_000)).ok, true);
  for (const [pattern, input, limit] of [['a'.repeat(501), '', /500/], ['', 'a'.repeat(100_001), /100,000/]] as const) {
    const result = runRegex(pattern, '', input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, limit);
  }
});

test('global zero-width matches advance and stop at end of input', () => {
  const result = runRegex('(?=a)', 'g', 'aaa');
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value.matches.map(({ start, end }) => [start, end]), [[0, 0], [1, 1], [2, 2]]);
});

test('caps results at 1000 and reports truncation only when more matches exist', () => {
  const exact = runRegex('a', 'g', 'a'.repeat(1000));
  const extra = runRegex('a', 'g', 'a'.repeat(1001));
  assert.equal(exact.ok, true);
  assert.equal(extra.ok, true);
  if (exact.ok && extra.ok) {
    assert.equal(exact.value.matches.length, 1000);
    assert.equal(exact.value.truncated, false);
    assert.equal(extra.value.matches.length, 1000);
    assert.equal(extra.value.truncated, true);
  }
});

test('reports positions, captures and requested flags', () => {
  const result = runRegex('(a)(b)?', 'gi', 'A ab');
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value.matches, [
    { start: 0, end: 1, text: 'A', captures: ['A', null] },
    { start: 2, end: 4, text: 'ab', captures: ['a', 'b'] },
  ]);
  assert.equal(runRegex('^a.b$', 'ms', 'x\na\nb').ok, true);
});

test('renders match and capture text without creating HTML elements', () => {
  const document = new JSDOM('').window.document;
  const target = document.createElement('div');
  const result = runRegex('(<img[^>]+>)', '', '<img src=x onerror=alert(1)>');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  renderRegexResults(target, result.value);
  assert.equal(target.querySelector('img, script'), null);
  assert.match(target.textContent ?? '', /<img src=x onerror=alert\(1\)>/);
  assert.match(summarizeRegexResults(result.value), /捕获 1：<img/);
});

test('caps rendered captures while retaining every match row and announcing omissions', () => {
  const result = runRegex('()'.repeat(200), 'g', 'a'.repeat(9));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.matches.length, 10);
  const document = new JSDOM('').window.document;
  const target = document.createElement('div');
  renderRegexResults(target, result.value);
  assert.equal(target.querySelectorAll('.tool-regex-row').length, 10);
  assert.equal(target.querySelectorAll('.tool-regex-capture').length, 1000);
  assert.match(target.firstElementChild?.textContent ?? '', /共 2000 个捕获组，仅显示前 1000 个/);
});

test('keeps DOM size bounded for 200 captures across 1000 matches', () => {
  const result = runRegex('()'.repeat(200), 'g', 'a'.repeat(999));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.matches.length, 1000);
  assert.equal(result.value.truncated, false);
  const document = new JSDOM('').window.document;
  const target = document.createElement('div');
  renderRegexResults(target, result.value);
  assert.equal(target.querySelectorAll('.tool-regex-row').length, 1000);
  assert.equal(target.querySelectorAll('.tool-regex-capture').length, 1000);
  assert.ok(target.querySelectorAll('*').length < 5000);
  assert.match(target.firstElementChild?.textContent ?? '', /共 200000 个捕获组，仅显示前 1000 个/);
});

test('page connects worker, lifecycle, clipboard and safe renderer', () => {
  const source = readFileSync(new URL('../../src/pages/tools/regex.astro', import.meta.url), 'utf8');
  assert.match(source, /new Worker\(new URL\('\.\.\/\.\.\/scripts\/regex-worker\.ts', import\.meta\.url\)/);
  assert.match(source, /runner\.dispose\(\)/);
  assert.match(source, /runner\.resume\(\)/);
  assert.match(source, /renderRegexResults\(/);
  assert.match(source, /copyText\(/);
  assert.doesNotMatch(source, /innerHTML/);
});
