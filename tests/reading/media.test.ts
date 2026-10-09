import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { mountArticleMedia } from '../../src/scripts/article-media.ts';

const fixture = () => {
  const window = new JSDOM(`
    <div data-article-body>
      <pre><code>const answer = 42;</code></pre>
      <a href="/images/example.webp"><img src="/images/example.webp" alt="示例图片"></a>
    </div>
    <dialog data-article-image-dialog><button type="button" data-image-close>关闭</button><img data-dialog-image alt=""></dialog>
    <p data-article-media-status role="status"></p>
  `, { url: 'https://example.com/posts/example/' }).window;
  const dialog = window.document.querySelector<HTMLDialogElement>('dialog')!;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new window.Event('close')); };
  return { window, document: window.document, dialog };
};

test('code copy reports success and failures without changing code text', async () => {
  const { window, document } = fixture();
  let copied = '';
  mountArticleMedia(document, window as unknown as Window, { writeText: async (text) => { copied = text; } });
  const button = document.querySelector<HTMLButtonElement>('.article-code-copy')!;
  assert.equal(document.querySelector('pre')?.firstElementChild, button);
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(copied, 'const answer = 42;');
  assert.match(document.querySelector('[data-article-media-status]')?.textContent ?? '', /已复制/);
  assert.equal(document.querySelector('pre code')?.textContent, 'const answer = 42;');

  const failed = fixture();
  mountArticleMedia(failed.document, failed.window as unknown as Window, { writeText: async () => { throw new Error('denied'); } });
  failed.document.querySelector<HTMLButtonElement>('.article-code-copy')!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(failed.document.querySelector('[data-article-media-status]')?.textContent ?? '', /无法复制/);
});

test('missing clipboard API leaves a manual-copy message', async () => {
  const { window, document } = fixture();
  mountArticleMedia(document, window as unknown as Window, undefined);
  document.querySelector<HTMLButtonElement>('.article-code-copy')!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(document.querySelector('[data-article-media-status]')?.textContent ?? '', /手动/);
});

test('image dialog opens and Escape or close returns focus to its opener', () => {
  const { window, document, dialog } = fixture();
  mountArticleMedia(document, window as unknown as Window, undefined);
  const link = document.querySelector<HTMLAnchorElement>('[data-article-body] a')!;
  link.focus();
  link.click();
  assert.equal(dialog.open, true);
  assert.match(document.querySelector<HTMLImageElement>('[data-dialog-image]')?.src ?? '', /example\.webp/);
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(dialog.open, false);
  assert.equal(document.activeElement, link);

  link.click();
  document.querySelector<HTMLButtonElement>('[data-image-close]')!.click();
  assert.equal(dialog.open, false);
  assert.equal(document.activeElement, link);
});

test('broken image closes the dialog and leaves actionable feedback', () => {
  const { window, document, dialog } = fixture();
  mountArticleMedia(document, window as unknown as Window, undefined);
  document.querySelector<HTMLAnchorElement>('[data-article-body] a')!.click();
  document.querySelector<HTMLImageElement>('[data-dialog-image]')!.dispatchEvent(new window.Event('error'));
  assert.equal(dialog.open, false);
  assert.match(document.querySelector('[data-article-media-status]')?.textContent ?? '', /无法加载/);
});

test('article markup keeps a direct image link without JavaScript', () => {
  const gallery = readFileSync(new URL('../../src/components/article/Gallery.astro', import.meta.url), 'utf8');
  assert.match(gallery, /<a href=\{src\}/);
  const page = readFileSync(new URL('../../src/pages/posts/[slug].astro', import.meta.url), 'utf8');
  assert.match(page, /data-article-image-dialog/);
  assert.match(page, /mountArticleMedia/);
});
