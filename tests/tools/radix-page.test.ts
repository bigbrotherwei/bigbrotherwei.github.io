import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { copyText, swapTransformation } from '../../src/lib/tools/browser.ts';
import { convertRadix } from '../../src/lib/tools/radix.ts';

const createPage = () => {
  const source = readFileSync(new URL('../../src/pages/tools/radix.astro', import.meta.url), 'utf8');
  const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'radix page needs a client script');

  const dom = new JSDOM(`
    <select id="radix-from"><option value="2">2</option><option value="36">36</option></select>
    <select id="radix-to"><option value="2">2</option><option value="36">36</option></select>
    <textarea id="radix-input"></textarea><textarea id="radix-output"></textarea>
    <p id="radix-status"></p>
    <button data-radix-action="swap"></button>
  `, { runScripts: 'outside-only' });
  Object.assign(dom.window, { convertRadix, copyText, swapTransformation });
  const executable = script.replace(/^\s*import .*;\s*$/gm, '');
  dom.window.eval(ts.transpileModule(executable, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);
  return dom;
};

test('swap preserves input, output and bases when the converted result exceeds 256 digits', () => {
  const dom = createPage();
  try {
    const document = dom.window.document;
    const from = document.querySelector<HTMLSelectElement>('#radix-from')!;
    const to = document.querySelector<HTMLSelectElement>('#radix-to')!;
    const input = document.querySelector<HTMLTextAreaElement>('#radix-input')!;
    const output = document.querySelector<HTMLTextAreaElement>('#radix-output')!;
    const status = document.querySelector<HTMLElement>('#radix-status')!;
    from.value = '36';
    to.value = '2';
    input.value = 'Z'.repeat(256);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    const originalOutput = output.value;
    assert.ok(originalOutput.length > 256);

    document.querySelector<HTMLButtonElement>('[data-radix-action="swap"]')!.click();

    assert.equal(input.value, 'Z'.repeat(256));
    assert.equal(output.value, originalOutput);
    assert.equal(from.value, '36');
    assert.equal(to.value, '2');
    assert.match(status.textContent ?? '', /结果.*超过 256 位/);
    assert.equal(status.dataset.state, 'error');
  } finally {
    dom.window.close();
  }
});

test('swap still accepts a negative result of exactly 256 digits', () => {
  const dom = createPage();
  try {
    const document = dom.window.document;
    const from = document.querySelector<HTMLSelectElement>('#radix-from')!;
    const to = document.querySelector<HTMLSelectElement>('#radix-to')!;
    const input = document.querySelector<HTMLTextAreaElement>('#radix-input')!;
    const output = document.querySelector<HTMLTextAreaElement>('#radix-output')!;
    from.value = '2';
    to.value = '2';
    input.value = `-${'1'.repeat(256)}`;
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(output.value.length, 257);

    document.querySelector<HTMLButtonElement>('[data-radix-action="swap"]')!.click();

    assert.equal(input.value, `-${'1'.repeat(256)}`);
    assert.equal(output.value, `-${'1'.repeat(256)}`);
    assert.equal(document.querySelector<HTMLElement>('#radix-status')!.dataset.state, 'success');
  } finally {
    dom.window.close();
  }
});
