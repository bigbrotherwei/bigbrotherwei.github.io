import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const readSource = (path) => readFileSync(resolve(root, path), 'utf8');
const assertIncludes = (source, token, label) => {
  if (!source.includes(token)) {
    throw new Error(`${label} is missing required token: ${token}`);
  }
};

const requiredLayoutTokens = [
  'canonicalPath?: string',
  "robots?: string",
  "pageType?: 'website' | 'article'",
  'structuredData?: JsonLdValue | readonly JsonLdValue[]',
  'rel="canonical"',
  'property="og:title"',
  'property="og:image"',
  'name="twitter:card"',
  'application/ld+json',
  'rel="alternate"',
  'application/rss+xml',
  'rel="sitemap"',
];

const layoutSource = readSource('src/layouts/BaseLayout.astro');
const homeSource = readSource('src/pages/index.astro');
const postSource = readSource('src/pages/posts/[slug].astro');

for (const token of requiredLayoutTokens) {
  assertIncludes(layoutSource, token, 'BaseLayout');
}

assertIncludes(homeSource, 'buildWebsiteJsonLd', 'homepage');
assertIncludes(postSource, 'buildBlogPostingJsonLd', 'post detail');
assertIncludes(postSource, 'buildBreadcrumbJsonLd', 'post detail');
assertIncludes(postSource, 'pageType="article"', 'post detail');

console.log('SEO source contracts verified.');
