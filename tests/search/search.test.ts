import assert from 'node:assert/strict';
import test from 'node:test';
import { createSearchRequestGuard, toSearchViewResult } from '../../src/lib/search.ts';
import { mountSearchPage } from '../../src/scripts/search-page.ts';

class SearchTestElement {
  readonly listeners = new Map<string, (() => void)[]>();
  readonly attributes = new Map<string, string>();
  readonly tagName: string;
  children: SearchTestElement[] = [];
  className = '';
  hidden = false;
  href = '';
  value = '';
  textContent = '';

  constructor(tagName = 'div') {
    this.tagName = tagName;
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string): void {
    this.listeners.get(type)?.forEach((listener) => listener());
  }

  append(...children: SearchTestElement[]): void {
    this.children.push(...children);
  }

  replaceChildren(...children: SearchTestElement[]): void {
    this.children = children;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
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

  createElement(tagName: string): SearchTestElement {
    return new SearchTestElement(tagName);
  }
}

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const waitForSearchStart = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 200));
};

const deferred = <Value>() => {
  let resolve: (value: Value) => void = () => {};
  const promise = new Promise<Value>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
};

const pagefindResult = (title: string, url: string) => ({
  data: () => Promise.resolve({
    url,
    plain_excerpt: `<b>${title} excerpt</b>`,
    meta: { title, type: '文章' },
  }),
});

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

test('rejects control characters that parse as a cross-origin result URL', () => {
  assert.throws(
    () => toSearchViewResult({
      url: '/\n/example.com',
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

test('keeps an in-flight non-empty search current after refocus', async () => {
  const document = new SearchTestDocument();
  let resolveSearch: (response: { readonly results: readonly [] }) => void = () => {};
  const pendingSearch = new Promise<{ readonly results: readonly [] }>((resolve) => {
    resolveSearch = resolve;
  });
  let searchCalls = 0;

  mountSearchPage(document as unknown as Document, () => Promise.resolve({
    search: () => {
      searchCalls += 1;
      return pendingSearch;
    },
  }));
  document.input.value = 'Astro';
  document.input.dispatch('input');
  await waitForSearchStart();
  document.input.dispatch('focus');
  resolveSearch({ results: [] });
  await flushPromises();

  assert.equal(searchCalls, 1);
  assert.equal(document.empty.hidden, false);
  assert.equal(document.status.textContent, '未找到匹配内容');
});

test('does not let an older query overwrite newer search results', async () => {
  const document = new SearchTestDocument();
  const olderResponse = deferred<{ readonly results: readonly ReturnType<typeof pagefindResult>[] }>();
  const queries: string[] = [];

  mountSearchPage(document as unknown as Document, () => Promise.resolve({
    search: (query: string) => {
      queries.push(query);
      return query === 'old'
        ? olderResponse.promise
        : Promise.resolve({ results: [pagefindResult('New result', '/posts/new/')] });
    },
  }));

  document.input.value = 'old';
  document.input.dispatch('input');
  await waitForSearchStart();
  document.input.value = 'new';
  document.input.dispatch('input');
  await waitForSearchStart();
  await flushPromises();

  olderResponse.resolve({ results: [pagefindResult('Old result', '/posts/old/')] });
  await flushPromises();

  const article = document.results.children[0];
  const heading = article?.children[1];
  const link = heading?.children[0];
  assert.deepEqual(queries, ['old', 'new']);
  assert.equal(link?.textContent, 'New result');
  assert.equal(link?.href, '/posts/new/');
  assert.equal(document.status.textContent, '找到 1 条结果');
});

test('renders non-empty search results as DOM nodes with literal excerpt text', async () => {
  const document = new SearchTestDocument();

  mountSearchPage(document as unknown as Document, () => Promise.resolve({
    search: () => Promise.resolve({
      results: [pagefindResult('Hello', '/posts/hello/')],
    }),
  }));

  document.input.value = 'hello';
  document.input.dispatch('input');
  await waitForSearchStart();
  await flushPromises();

  const article = document.results.children[0];
  const [type, heading, excerpt] = article?.children ?? [];
  const link = heading?.children[0];
  assert.equal(document.results.hidden, false);
  assert.equal(article?.tagName, 'article');
  assert.equal(type?.tagName, 'span');
  assert.equal(type?.textContent, '文章');
  assert.equal(heading?.tagName, 'h2');
  assert.equal(link?.tagName, 'a');
  assert.equal(link?.href, '/posts/hello/');
  assert.equal(link?.textContent, 'Hello');
  assert.equal(excerpt?.tagName, 'p');
  assert.equal(excerpt?.textContent, '<b>Hello excerpt</b>');
});
