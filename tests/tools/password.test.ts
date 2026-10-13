import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { generatePassword } from '../../src/lib/tools/password.ts';
import type { ToolResult } from '../../src/lib/tools/result.ts';

const options = { length: 8, lower: true, upper: false, digits: false, symbols: false };
const zeros = (count: number) => new Uint8Array(count);

test('accepts the 8 and 64 character boundaries', () => {
  for (const length of [8, 64]) {
    const result = generatePassword({ ...options, length }, zeros);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.length, length);
  }
});

test('rejects invalid lengths and an empty character selection', () => {
  for (const length of [7, 65, 8.5, NaN, Infinity]) {
    assert.equal(generatePassword({ ...options, length }, zeros).ok, false);
  }
  assert.equal(generatePassword({ ...options, lower: false }, zeros).ok, false);
});

test('includes every enabled group and excludes disabled groups', () => {
  const result = generatePassword({ length: 8, lower: true, upper: true, digits: true, symbols: true }, zeros);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.value, /[a-z]/);
  assert.match(result.value, /[A-Z]/);
  assert.match(result.value, /[0-9]/);
  assert.match(result.value, /[^a-zA-Z0-9]/);
  const digits = generatePassword({ ...options, lower: false, digits: true }, zeros);
  assert.equal(digits.ok, true);
  if (digits.ok) assert.match(digits.value, /^[0-9]{8}$/);
});

test('rejects out-of-range random bytes before choosing a character', () => {
  const supplied = [234, 255, 25, ...Array(30).fill(0)];
  let calls = 0;
  const result = generatePassword(options, (count) => {
    assert.equal(count, 1);
    return Uint8Array.of(supplied[calls++] ?? 0);
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.match(result.value, /z/);
  assert.ok(calls >= 10, 'rejected bytes must be retried');
});

test('rejects a byte outside the shuffle range too', () => {
  const supplied = [...Array(9).fill(0), 255, 6, ...Array(20).fill(0)];
  let calls = 0;
  const result = generatePassword(options, () => Uint8Array.of(supplied[calls++] ?? 0));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value, 'aaaaaa aa'.replace(' ', ''));
  assert.equal(calls, 16);
});

const createPage = (
  randomValue: number,
  copyText: (_value: string) => Promise<ToolResult<true>> = async () => ({ ok: true, value: true }),
) => {
  const source = readFileSync(new URL('../../src/pages/tools/password.astro', import.meta.url), 'utf8');
  const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'password page needs a client script');
  const dom = new JSDOM(`
    <input id="password-length" type="number" value="16">
    <input id="password-lower" type="checkbox" checked>
    <input id="password-upper" type="checkbox" checked>
    <input id="password-digits" type="checkbox" checked>
    <input id="password-symbols" type="checkbox">
    <button data-password-action="generate"></button>
    <button data-password-action="copy" disabled></button>
    <button data-password-action="reset"></button>
    <textarea id="password-output" readonly></textarea><p id="password-status"></p>
  `, { runScripts: 'outside-only' });
  Object.assign(dom.window, { generatePassword, copyText });
  Object.defineProperty(dom.window, 'crypto', {
    value: { getRandomValues: (bytes: Uint8Array) => { bytes.fill(randomValue); return bytes; } },
    configurable: true,
  });
  dom.window.eval(ts.transpileModule(script.replace(/^\s*import .*;\s*$/gm, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText);
  return dom;
};

test('page generates, copies, and clears the previous password on reset', async () => {
  const copied: string[] = [];
  const dom = createPage(0, async (value) => { copied.push(value); return { ok: true, value: true }; });
  try {
    const document = dom.window.document;
    const output = document.querySelector<HTMLTextAreaElement>('#password-output')!;
    document.querySelector<HTMLButtonElement>('[data-password-action="generate"]')!.click();
    assert.equal(output.value.length, 16);
    assert.equal(document.querySelector<HTMLButtonElement>('[data-password-action="copy"]')!.disabled, false);
    document.querySelector<HTMLButtonElement>('[data-password-action="copy"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(copied, [output.value]);
    document.querySelector<HTMLButtonElement>('[data-password-action="reset"]')!.click();
    assert.equal(output.value, '');
    assert.equal(document.querySelector<HTMLButtonElement>('[data-password-action="copy"]')!.disabled, true);
    assert.equal(document.querySelector<HTMLInputElement>('#password-length')!.value, '16');
  } finally { dom.window.close(); }
});

test('changing settings invalidates the previous password and a failed copy is reported', async () => {
  const dom = createPage(0, async () => ({ ok: false, error: '复制失败' }));
  try {
    const document = dom.window.document;
    const output = document.querySelector<HTMLTextAreaElement>('#password-output')!;
    document.querySelector<HTMLButtonElement>('[data-password-action="generate"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-password-action="copy"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(document.querySelector<HTMLElement>('#password-status')!.dataset.state, 'error');
    document.querySelector<HTMLInputElement>('#password-symbols')!.click();
    assert.equal(output.value, '');
    assert.equal(document.querySelector<HTMLButtonElement>('[data-password-action="copy"]')!.disabled, true);
  } finally { dom.window.close(); }
});
