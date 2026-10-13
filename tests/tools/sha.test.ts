import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { digestBytes, validateHashFile } from '../../src/lib/tools/sha.ts';

const subtle = webcrypto.subtle as unknown as SubtleCrypto;

const vectors = {
  'SHA-256': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  'SHA-384': 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
  'SHA-512': 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
} as const;

test('digests UTF-8 bytes to lowercase known SHA vectors', async () => {
  const bytes = new TextEncoder().encode('abc');
  for (const [algorithm, expected] of Object.entries(vectors) as [keyof typeof vectors, string][]) {
    assert.equal(await digestBytes(bytes.buffer, algorithm, subtle), expected);
  }
});

test('accepts 32 MiB exactly and rejects larger files', () => {
  assert.deepEqual(validateHashFile({ size: 32 * 1024 * 1024 }), { ok: true, value: undefined });
  const tooLarge = validateHashFile({ size: 32 * 1024 * 1024 + 1 });
  assert.equal(tooLarge.ok, false);
  if (!tooLarge.ok) assert.match(tooLarge.error, /32 MiB/);
});

const createPage = (subtle?: SubtleCrypto, copyText = async () => ({ ok: true })) => {
  const source = readFileSync(new URL('../../src/pages/tools/sha.astro', import.meta.url), 'utf8');
  const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'SHA page needs a client script');
  const dom = new JSDOM(`
    <button data-sha-mode="text" aria-pressed="true"></button>
    <button data-sha-mode="file" aria-pressed="false"></button>
    <div id="sha-text-panel"><textarea id="sha-text"></textarea></div>
    <div id="sha-file-panel" hidden><input id="sha-file" type="file"></div>
    <select id="sha-algorithm"><option value="SHA-256">SHA-256</option><option value="SHA-384">SHA-384</option><option value="SHA-512">SHA-512</option></select>
    <button data-sha-action="digest"></button><button data-sha-action="copy"></button>
    <textarea id="sha-output"></textarea><p id="sha-status"></p>
  `, { runScripts: 'outside-only' });
  Object.assign(dom.window, { digestBytes, validateHashFile, copyText, TextEncoder });
  Object.defineProperty(dom.window, 'crypto', { value: subtle ? { subtle } : {}, configurable: true });
  const executable = script.replace(/^\s*import .*;\s*$/gm, '');
  dom.window.eval(ts.transpileModule(executable, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);
  return dom;
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const waitFor = async (condition: () => boolean) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('SHA page did not settle within one second');
};

test('page reports unsupported Web Crypto without reading a selected file', async () => {
  const dom = createPage();
  try {
    const document = dom.window.document;
    document.querySelector<HTMLButtonElement>('[data-sha-mode="file"]')!.click();
    let reads = 0;
    const file = { size: 3, name: 'abc.txt', arrayBuffer: async () => { reads++; return new TextEncoder().encode('abc').buffer; } };
    Object.defineProperty(document.querySelector('#sha-file'), 'files', { value: [file], configurable: true });
    document.querySelector<HTMLButtonElement>('[data-sha-action="digest"]')!.click();
    await tick();
    assert.equal(reads, 0);
    assert.match(document.querySelector('#sha-status')!.textContent ?? '', /Web Crypto|浏览器.*支持/);
    assert.equal(document.querySelector<HTMLElement>('#sha-status')!.dataset.state, 'error');
  } finally { dom.window.close(); }
});

test('page rejects oversized file before arrayBuffer is called', async () => {
  const dom = createPage(subtle);
  try {
    const document = dom.window.document;
    document.querySelector<HTMLButtonElement>('[data-sha-mode="file"]')!.click();
    let reads = 0;
    const file = { size: 32 * 1024 * 1024 + 1, name: 'large.bin', arrayBuffer: async () => { reads++; return new ArrayBuffer(0); } };
    Object.defineProperty(document.querySelector('#sha-file'), 'files', { value: [file], configurable: true });
    document.querySelector<HTMLButtonElement>('[data-sha-action="digest"]')!.click();
    await tick();
    assert.equal(reads, 0);
    assert.match(document.querySelector('#sha-status')!.textContent ?? '', /32 MiB/);
    assert.equal(document.querySelector<HTMLTextAreaElement>('#sha-output')!.value, '');
  } finally { dom.window.close(); }
});

test('page hashes text and a local file in their selected modes', async () => {
  const dom = createPage(subtle);
  try {
    const document = dom.window.document;
    const input = document.querySelector<HTMLTextAreaElement>('#sha-text')!;
    const output = document.querySelector<HTMLTextAreaElement>('#sha-output')!;
    input.value = 'abc';
    document.querySelector<HTMLButtonElement>('[data-sha-action="digest"]')!.click();
    await waitFor(() => output.value === vectors['SHA-256']);
    assert.equal(output.value, vectors['SHA-256']);

    document.querySelector<HTMLButtonElement>('[data-sha-mode="file"]')!.click();
    assert.equal(output.value, '');
    assert.equal(document.querySelector<HTMLElement>('#sha-file-panel')!.hidden, false);
    let reads = 0;
    const file = { size: 3, name: 'abc.txt', arrayBuffer: async () => { reads++; return new TextEncoder().encode('abc').buffer; } };
    Object.defineProperty(document.querySelector('#sha-file'), 'files', { value: [file], configurable: true });
    document.querySelector<HTMLSelectElement>('#sha-algorithm')!.value = 'SHA-512';
    document.querySelector<HTMLButtonElement>('[data-sha-action="digest"]')!.click();
    await waitFor(() => output.value === vectors['SHA-512']);
    assert.equal(reads, 1);
    assert.equal(output.value, vectors['SHA-512']);
  } finally { dom.window.close(); }
});

test('page reports a failed copy', async () => {
  const dom = createPage(subtle, async () => ({ ok: false, error: '剪贴板不可用' }));
  try {
    const document = dom.window.document;
    document.querySelector<HTMLTextAreaElement>('#sha-output')!.value = vectors['SHA-256'];
    document.querySelector<HTMLButtonElement>('[data-sha-action="copy"]')!.click();
    await tick();
    assert.match(document.querySelector('#sha-status')!.textContent ?? '', /剪贴板不可用/);
    assert.equal(document.querySelector<HTMLElement>('#sha-status')!.dataset.state, 'error');
  } finally { dom.window.close(); }
});
