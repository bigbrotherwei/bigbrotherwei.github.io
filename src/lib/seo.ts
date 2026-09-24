export type JsonLdScalar = string | number | boolean | null;
export type JsonLdValue =
  | JsonLdScalar
  | { readonly [key: string]: JsonLdValue }
  | readonly JsonLdValue[];

type JsonLdObject = { readonly [key: string]: JsonLdValue };

const AUTHOR_NAME = 'bigbrotherwei';
const AUTHOR_URL = 'https://github.com/bigbrotherwei';

export interface JsonLdAuthor extends JsonLdObject {
  readonly '@type': 'Person';
  readonly name: typeof AUTHOR_NAME;
  readonly url: typeof AUTHOR_URL;
}

export interface WebsiteJsonLd extends JsonLdObject {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'WebSite';
  readonly name: typeof AUTHOR_NAME;
  readonly url: string;
  readonly inLanguage: 'zh-CN';
  readonly author: JsonLdAuthor;
}

export interface BlogPostingJsonLd extends JsonLdObject {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'BlogPosting';
  readonly headline: string;
  readonly description: string;
  readonly datePublished: string;
  readonly dateModified?: string;
  readonly mainEntityOfPage: string;
  readonly keywords: readonly string[];
  readonly author: JsonLdAuthor;
  readonly image: string;
}

export interface BreadcrumbItem {
  readonly name: string;
  readonly path: string | URL;
}

export interface BreadcrumbListItem extends JsonLdObject {
  readonly '@type': 'ListItem';
  readonly position: number;
  readonly name: string;
  readonly item: string;
}

export interface BreadcrumbListJsonLd extends JsonLdObject {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'BreadcrumbList';
  readonly itemListElement: readonly BreadcrumbListItem[];
}

export interface WebsiteJsonLdInput {
  readonly site: string | URL;
}

export interface BlogPostingJsonLdInput {
  readonly site: string | URL;
  readonly path: string | URL;
  readonly title: string;
  readonly description: string;
  readonly publishedAt: Date;
  readonly updatedAt?: Date;
  readonly tags: readonly string[];
  readonly imagePath: string | URL;
}

const author = (): JsonLdAuthor => ({
  '@type': 'Person',
  name: AUTHOR_NAME,
  url: AUTHOR_URL,
});

export const buildCanonicalUrl = (site: string | URL, path: string | URL): URL => {
  const url = new URL(path, site);
  url.search = '';
  url.hash = '';
  return url;
};

export const buildWebsiteJsonLd = ({ site }: WebsiteJsonLdInput): WebsiteJsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: AUTHOR_NAME,
  url: buildCanonicalUrl(site, '/').href,
  inLanguage: 'zh-CN',
  author: author(),
});

export const buildBlogPostingJsonLd = ({
  site,
  path,
  title,
  description,
  publishedAt,
  updatedAt,
  tags,
  imagePath,
}: BlogPostingJsonLdInput): BlogPostingJsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: title,
  description,
  datePublished: publishedAt.toISOString(),
  ...(updatedAt ? { dateModified: updatedAt.toISOString() } : {}),
  mainEntityOfPage: buildCanonicalUrl(site, path).href,
  keywords: tags,
  author: author(),
  image: buildCanonicalUrl(site, imagePath).href,
});

export const buildBreadcrumbJsonLd = (
  items: readonly BreadcrumbItem[],
  site: string | URL,
): BreadcrumbListJsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: buildCanonicalUrl(site, item.path).href,
  })),
});

export const serializeJsonLd = (value: JsonLdValue): string =>
  JSON.stringify(value).replace(/</g, '\\u003c');
