import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { validateToolPageContract } from '../../scripts/lib/tool-page-contracts.mjs';
import { compareText, renderDiff, summarizeDiff, swapDiffInputs } from '../../src/lib/tools/text-diff.ts';

test('line mode preserves Chinese text and newline boundaries', () => {
  const result = compareText('第一行\n旧行\n', '第一行\n新行\n', 'line');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value, [
    { kind: 'same', value: '第一行\n' },
    { kind: 'remove', value: '旧行\n' },
    { kind: 'add', value: '新行\n' },
  ]);
});

test('word mode isolates a changed Chinese word while retaining surrounding text', () => {
  const result = compareText('今天吃苹果。', '今天吃香蕉。', 'word');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.filter((chunk) => chunk.kind !== 'add').map((chunk) => chunk.value).join(''), '今天吃苹果。');
  assert.equal(result.value.filter((chunk) => chunk.kind !== 'remove').map((chunk) => chunk.value).join(''), '今天吃香蕉。');
  assert.ok(result.value.some((chunk) => chunk.kind === 'remove' && chunk.value.includes('苹果')));
  assert.ok(result.value.some((chunk) => chunk.kind === 'add' && chunk.value.includes('香蕉')));
  assert.ok(result.value.some((chunk) => chunk.kind === 'same' && chunk.value.includes('今天吃')));
});

test('word mode reports spacing-only edits instead of marking the texts identical', () => {
  const result = compareText('a b', 'a  b', 'word');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.value.some((chunk) => chunk.kind === 'remove' || chunk.kind === 'add'));
  assert.equal(result.value.filter((chunk) => chunk.kind !== 'add').map((chunk) => chunk.value).join(''), 'a b');
  assert.equal(result.value.filter((chunk) => chunk.kind !== 'remove').map((chunk) => chunk.value).join(''), 'a  b');
});

test('identical and empty inputs have unambiguous unchanged results', () => {
  assert.deepEqual(compareText('', '', 'line'), { ok: true, value: [] });
  assert.deepEqual(compareText('相同\n', '相同\n', 'word'), {
    ok: true, value: [{ kind: 'same', value: '相同\n' }],
  });
});

test('each side accepts 100,000 characters and rejects 100,001', () => {
  assert.equal(compareText('a'.repeat(100_000), '', 'line').ok, true);
  for (const [oldText, newText] of [['a'.repeat(100_001), ''], ['', 'b'.repeat(100_001)]]) {
    const result = compareText(oldText, newText, 'line');
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /100,000/);
  }
});

test('reports the diff library timeout instead of exposing partial output', () => {
  const result = compareText('a '.repeat(50_000), 'b '.repeat(50_000), 'word', 0);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /超时|缩短/);
});

test('renders HTML-looking input as text nodes with visible change labels', () => {
  const document = new JSDOM('').window.document;
  const target = document.createElement('div');
  renderDiff(target, [
    { kind: 'remove', value: '<img src=x onerror=alert(1)>' },
    { kind: 'add', value: '<script>alert(2)</script>' },
  ]);
  assert.equal(target.querySelector('img, script'), null);
  assert.match(target.textContent ?? '', /删除：<img src=x onerror=alert\(1\)>/);
  assert.match(target.textContent ?? '', /新增：<script>alert\(2\)<\/script>/);
});

test('swap reverses old and new input and summary copies plain changes', () => {
  assert.deepEqual(swapDiffInputs('旧', '新'), { oldText: '新', newText: '旧' });
  const result = compareText('旧\n', '新\n', 'line');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(summarizeDiff(result.value), '删除：旧\n新增：新\n');
});

test('copied multiline changes label every line, including blank lines', () => {
  assert.equal(summarizeDiff([
    { kind: 'remove', value: '旧一\n\n旧三\n' },
    { kind: 'add', value: '新一\n新二' },
  ]), '删除：旧一\n删除：\n删除：旧三\n新增：新一\n新增：新二\n');
});

test('page contract connects the worker runner and clipboard actions', () => {
  const source = readFileSync(new URL('../../src/pages/tools/text-diff.astro', import.meta.url), 'utf8');
  assert.deepEqual(validateToolPageContract(source, {
    slug: 'text-diff',
    backgroundKey: 'tool-text-diff',
    logicModule: 'text-diff.ts',
    logicCalls: ['createTextDiffRunner', 'renderDiff', 'summarizeDiff', 'swapDiffInputs'],
    browserModule: 'browser.ts',
    browserCalls: ['copyText'],
  }), []);
  assert.match(source, /new Worker\(new URL\('\.\.\/\.\.\/scripts\/text-diff-worker\.ts', import\.meta\.url\)/);
  assert.doesNotMatch(source, /\bcompareText\s*\(/);
  assert.match(source, /statusInside/);
});
