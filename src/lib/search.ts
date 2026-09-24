export interface PagefindSearchResultData {
  readonly url: string;
  readonly plain_excerpt: string;
  readonly meta: Readonly<Record<string, string | undefined>>;
}

export interface SearchViewResult {
  readonly url: string;
  readonly title: string;
  readonly type: string;
  readonly excerpt: string;
}

export interface SearchRequestGuard {
  begin(): number;
  isCurrent(request: number): boolean;
}

const fallback = (value: string | undefined, defaultValue: string): string =>
  value?.trim() || defaultValue;

export const toSearchViewResult = (data: PagefindSearchResultData): SearchViewResult => {
  const siteUrl = new URL('https://search.local/');
  const resultUrl = new URL(data.url, siteUrl);

  if (!data.url.startsWith('/') || resultUrl.origin !== siteUrl.origin) {
    throw new Error(`Pagefind result URL must be root-relative: ${data.url}`);
  }

  return Object.freeze({
    url: `${resultUrl.pathname}${resultUrl.search}${resultUrl.hash}`,
    title: fallback(data.meta.title, '未命名内容'),
    type: fallback(data.meta.type, '内容'),
    excerpt: data.plain_excerpt,
  });
};

export const createSearchRequestGuard = (): SearchRequestGuard => {
  let currentRequest = 0;

  return {
    begin: () => {
      currentRequest += 1;
      return currentRequest;
    },
    isCurrent: (request) => request === currentRequest,
  };
};
