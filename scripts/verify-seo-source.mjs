import { existsSync, readFileSync } from 'node:fs';
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
const feedSource = readSource('src/lib/feed.ts');
const rssSource = readSource('src/pages/rss.xml.ts');
const robotsSource = readSource('src/pages/robots.txt.ts');
const configSource = readSource('astro.config.mjs');
const navSource = readSource('src/components/SiteNav.astro');
const searchScriptSource = readSource('src/scripts/search-page.ts');
const searchPagePath = 'src/pages/search/index.astro';
const searchableTemplates = new Map([
  ['src/pages/posts/[slug].astro', 'type:文章'],
  ['src/pages/topics/[slug].astro', 'type:专题'],
  ['src/pages/projects/[slug].astro', 'type:项目'],
  ['src/components/tools/ToolLayout.astro', 'type:工具'],
]);
const nonSearchableSources = [
  'src/pages/search/index.astro',
  'src/pages/posts/index.astro',
  'src/pages/topics/index.astro',
  'src/pages/projects/index.astro',
  'src/pages/tools/index.astro',
  'src/pages/archive/index.astro',
  'src/pages/tags/index.astro',
  'src/pages/tags/[slug].astro',
  'src/pages/about.astro',
];

for (const token of requiredLayoutTokens) {
  assertIncludes(layoutSource, token, 'BaseLayout');
}

assertIncludes(homeSource, 'buildWebsiteJsonLd', 'homepage');
assertIncludes(postSource, 'buildBlogPostingJsonLd', 'post detail');
assertIncludes(postSource, 'buildBreadcrumbJsonLd', 'post detail');
assertIncludes(postSource, 'pageType="article"', 'post detail');

assertIncludes(feedSource, '!post.data.draft', 'RSS feed mapping');
assertIncludes(rssSource, "getCollection('posts')", 'RSS route');
assertIncludes(rssSource, "@astrojs/rss", 'RSS route');
assertIncludes(rssSource, '<language>zh-CN</language>', 'RSS route');
assertIncludes(robotsSource, 'User-agent: *', 'robots route');
assertIncludes(robotsSource, 'Allow: /', 'robots route');
assertIncludes(robotsSource, "new URL('/sitemap-index.xml', context.site!)", 'robots route');
assertIncludes(configSource, "@astrojs/sitemap", 'Astro config');
assertIncludes(configSource, "page !== 'https://bigbrotherwei.github.io/search/'", 'Astro config');
assertIncludes(configSource, 'news: false', 'Astro config');
assertIncludes(configSource, 'video: false', 'Astro config');
assertIncludes(configSource, 'xhtml: false', 'Astro config');
assertIncludes(configSource, 'image: false', 'Astro config');

assertIncludes(navSource, "import { Search } from 'lucide-astro'", 'site navigation');
assertIncludes(navSource, 'href="/search/"', 'site navigation');
assertIncludes(navSource, 'aria-label="搜索"', 'site navigation');
assertIncludes(navSource, 'title="搜索"', 'site navigation');

if (!existsSync(resolve(root, searchPagePath))) {
  throw new Error(`Missing search page: ${searchPagePath}`);
}

const searchPageSource = readSource(searchPagePath);
for (const token of [
  'robots="noindex,follow"',
  'backgroundKey="search-index"',
  '<noscript>',
  'for="site-search"',
  'data-search-input',
  'data-search-status',
  'data-search-results',
  'data-search-idle',
  'data-search-empty',
  'data-search-error',
  'mountSearchPage(document)',
]) {
  assertIncludes(searchPageSource, token, 'search page');
}

for (const [source, label] of [
  [searchPageSource, 'search page'],
  [searchScriptSource, 'search script'],
]) {
  if (source.includes('innerHTML')) {
    throw new Error(`${label} must not use innerHTML`);
  }
}

const pagefindBoundaryErrors = [];

for (const [path, typeMetadata] of searchableTemplates) {
  const source = readSource(path);
  if (!source.includes('data-pagefind-body')) {
    pagefindBoundaryErrors.push(`${path} is missing data-pagefind-body`);
  }
  if (!source.includes(`data-pagefind-meta="${typeMetadata}"`)) {
    pagefindBoundaryErrors.push(`${path} is missing data-pagefind-meta="${typeMetadata}"`);
  }
}

for (const path of nonSearchableSources) {
  if (!existsSync(resolve(root, path))) {
    continue;
  }

  const source = readSource(path);
  if (source.includes('data-pagefind-body')) {
    throw new Error(`${path} must not define a Pagefind searchable body`);
  }
}

if (pagefindBoundaryErrors.length > 0) {
  throw new Error(pagefindBoundaryErrors.join('\n'));
}

console.log('SEO source contracts verified.');
