import assert from 'node:assert/strict';
import test from 'node:test';
import { createSearchRequestGuard, toSearchViewResult } from '../../src/lib/search.ts';
import { mountSearchPage } from '../../src/scripts/search-page.ts';

class SearchTestElement {
  readonly listeners = new Map<string, (() => void)[]>();
  hidden = false;
  value = '';
  textContent = '';

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string): void {
    this.listeners.get(type)?.forEach((listener) => listener());
  }

  replaceChildren(..._children: SearchTestElement[]): void {}

  setAttribute(_name: string, _value: string): void {}
}

class SearchTestDocument {
  readonly input = new SearchTestElement();
  readonly status = new SearchTestElement();
  readonly results = new SearchTestElement();
  readonly idle = new SearchTestElement();
  readonly empty = new SearchTestElement();
  readonly error = new SearchTestElement();

  readonly elements = new Map([
    ['[data-search-input]', this.input],
    ['[data-search-status]', this.status],
    ['[data-search-results]', this.results],
    ['[data-search-idle]', this.idle],
    ['[data-search-empty]', this.empty],
    ['[data-search-error]', this.error],
  ]);

  querySelector(selector: string): SearchTestElement | null {
    return this.elements.get(selector) ?? null;
  }
}

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

test('maps a Pagefind record without interpreting its excerpt as HTML', () => {
  assert.deepEqual(toSearchViewResult({
    url: '/posts/hello/',
    plain_excerpt: '<b>plain text</b>',
    meta: { title: 'Hello', type: '文章' },
  }), {
    url: '/posts/hello/',
    title: 'Hello',
    type: '文章',
    excerpt: '<b>plain text</b>',
  });
});

test('uses readable fallbacks for blank Pagefind metadata', () => {
  assert.deepEqual(toSearchViewResult({
    url: '/topics/',
    plain_excerpt: '',
    meta: { title: '   ', type: '' },
  }), {
    url: '/topics/',
    title: '未命名内容',
    type: '内容',
    excerpt: '',
  });
});

test('rejects a Pagefind result outside the site root', () => {
  assert.throws(
    () => toSearchViewResult({
      url: 'https://example.com/posts/hello/',
      plain_excerpt: 'plain text',
      meta: { title: 'Hello', type: '文章' },
    }),
    /root-relative/u,
  );
});

test('only treats the newest search request as current', () => {
  const guard = createSearchRequestGuard();
  const first = guard.begin();
  const second = guard.begin();

  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});

test('keeps a cleared query idle when its focus-triggered Pagefind load fails', async () => {
  const document = new SearchTestDocument();
  let rejectLoad: (reason: Error) => void = () => {};
  const pagefindLoad = new Promise<never>((_resolve, reject) => {
    rejectLoad = reject;
  });

  mountSearchPage(document as unknown as Document, () => pagefindLoad);
  document.input.dispatch('focus');
  document.input.value = 'Astro';
  document.input.dispatch('input');
  document.input.value = '';
  document.input.dispatch('input');
  rejectLoad(new Error('Pagefind unavailable'));
  await flushPromises();

  assert.equal(document.idle.hidden, false);
  assert.equal(document.error.hidden, true);
  assert.equal(document.status.textContent, '输入关键词开始搜索');
});
