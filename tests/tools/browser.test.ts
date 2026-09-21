import assert from 'node:assert/strict';
import test from 'node:test';
import { copyText, debounce, swapTransformation } from '../../src/lib/tools/browser.ts';

test('copies text through the supplied clipboard implementation', async () => {
  const copied: string[] = [];

  const result = await copyText('博客工具箱', {
    writeText: async (value) => {
      copied.push(value);
    },
  });

  assert.deepEqual(result, { ok: true, value: true });
  assert.deepEqual(copied, ['博客工具箱']);
});

test('returns an actionable error when the clipboard rejects a copy', async () => {
  const result = await copyText('博客工具箱', {
    writeText: async () => {
      throw new Error('Permission denied');
    },
  });

  assert.deepEqual(result, { ok: false, error: '复制失败，请检查浏览器权限' });
});

test('returns an actionable error when the clipboard API is unavailable', async () => {
  const result = await copyText('博客工具箱', undefined);

  assert.deepEqual(result, { ok: false, error: '复制失败，请检查浏览器权限' });
});

test('debounce replaces an earlier pending call with the latest call', async () => {
  const calls: string[] = [];
  const collect = debounce((value: string) => calls.push(value), 10);

  collect('first');
  collect('latest');

  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.deepEqual(calls, ['latest']);
});

test('swaps transformation values and reverses the conversion mode', () => {
  assert.deepEqual(swapTransformation({ input: 'a b', output: 'a%20b', mode: 'encode' }), {
    input: 'a%20b',
    output: 'a b',
    mode: 'decode',
  });
});
