import {
  createSearchRequestGuard,
  toSearchViewResult,
  type PagefindSearchResultData,
  type SearchViewResult,
} from '../lib/search.ts';

interface PagefindResult {
  data(): Promise<PagefindSearchResultData>;
}

interface PagefindClient {
  search(query: string): Promise<{ readonly results: readonly PagefindResult[] }>;
}

type PagefindLoader = () => Promise<PagefindClient>;
type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error';

const SEARCH_DEBOUNCE_MS = 180;
const MAX_RESULT_RECORDS = 20;

const defaultPagefindLoader: PagefindLoader = () =>
  // @ts-expect-error Pagefind is emitted into dist after Astro checks source modules.
  import(/* @vite-ignore */ '/pagefind/pagefind.js') as unknown as Promise<PagefindClient>;

const requireElement = <ElementType extends Element>(document: Document, selector: string): ElementType => {
  const element = document.querySelector<ElementType>(selector);

  if (!element) {
    throw new Error(`Search page setup is missing required ${selector} element.`);
  }

  return element;
};

const createResultElement = (document: Document, result: SearchViewResult): HTMLElement => {
  const article = document.createElement('article');
  const type = document.createElement('span');
  const heading = document.createElement('h2');
  const link = document.createElement('a');
  const excerpt = document.createElement('p');

  article.className = 'search-result';
  type.className = 'search-result__type';
  heading.className = 'search-result__title';
  link.className = 'search-result__link';
  excerpt.className = 'search-result__excerpt';

  type.textContent = result.type;
  link.href = result.url;
  link.textContent = result.title;
  excerpt.textContent = result.excerpt;

  heading.append(link);
  article.append(type, heading, excerpt);

  return article;
};

export const mountSearchPage = (
  document: Document,
  loadPagefind: PagefindLoader = defaultPagefindLoader,
): void => {
  const input = requireElement<HTMLInputElement>(document, '[data-search-input]');
  const status = requireElement<HTMLElement>(document, '[data-search-status]');
  const results = requireElement<HTMLElement>(document, '[data-search-results]');
  const idle = requireElement<HTMLElement>(document, '[data-search-idle]');
  const empty = requireElement<HTMLElement>(document, '[data-search-empty]');
  const error = requireElement<HTMLElement>(document, '[data-search-error]');
  const requestGuard = createSearchRequestGuard();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let pagefindPromise: Promise<PagefindClient> | undefined;

  status.setAttribute('aria-live', 'polite');

  const setState = (state: SearchState, statusText: string): void => {
    idle.hidden = state !== 'idle';
    results.hidden = state !== 'results';
    empty.hidden = state !== 'empty';
    error.hidden = state !== 'error';
    status.textContent = statusText;
  };

  const setIdle = (): void => {
    results.replaceChildren();
    setState('idle', '输入关键词开始搜索');
  };

  const setLoading = (): void => {
    results.replaceChildren();
    setState('loading', '正在搜索');
  };

  const setResults = (viewResults: readonly SearchViewResult[]): void => {
    results.replaceChildren(...viewResults.map((result) => createResultElement(document, result)));
    setState('results', `找到 ${viewResults.length} 条结果`);
  };

  const setEmpty = (): void => {
    results.replaceChildren();
    setState('empty', '未找到匹配内容');
  };

  const setError = (): void => {
    results.replaceChildren();
    setState('error', '搜索暂时不可用，请稍后重试');
  };

  const getPagefind = (): Promise<PagefindClient> => {
    if (!pagefindPromise) {
      pagefindPromise = loadPagefind().catch((loadError: unknown) => {
        pagefindPromise = undefined;
        throw loadError;
      });
    }

    return pagefindPromise;
  };

  const runSearch = async (query: string, request: number): Promise<void> => {
    try {
      const pagefind = await getPagefind();
      if (!requestGuard.isCurrent(request)) return;

      const response = await pagefind.search(query);
      if (!requestGuard.isCurrent(request)) return;

      const records = await Promise.all(response.results.slice(0, MAX_RESULT_RECORDS).map((result) => result.data()));
      if (!requestGuard.isCurrent(request)) return;

      const viewResults = records.map(toSearchViewResult);
      if (viewResults.length === 0) {
        setEmpty();
        return;
      }

      setResults(viewResults);
    } catch {
      if (requestGuard.isCurrent(request)) setError();
    }
  };

  const scheduleSearch = (): void => {
    const query = input.value.trim();
    const request = requestGuard.begin();

    if (debounceTimer) clearTimeout(debounceTimer);

    if (!query) {
      setIdle();
      return;
    }

    setLoading();
    void getPagefind().catch(() => {
      if (requestGuard.isCurrent(request)) setError();
    });
    debounceTimer = setTimeout(() => void runSearch(query, request), SEARCH_DEBOUNCE_MS);
  };

  input.addEventListener('focus', () => {
    void getPagefind().catch(setError);
  });
  input.addEventListener('input', scheduleSearch);
  setIdle();
};
