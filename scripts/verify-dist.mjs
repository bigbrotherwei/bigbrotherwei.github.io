import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const siteOrigin = 'https://bigbrotherwei.github.io';
const failures = [];

const read = (path) => readFileSync(path, 'utf8');
const toRoute = (path) => {
  const relativePath = relative(dist, path).split(sep).join('/');
  return relativePath === 'index.html' ? '/' : `/${relativePath.replace(/index\.html$/, '')}`;
};

const collectFiles = (directory, predicate) => {
  if (!existsSync(directory)) return [];

  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? collectFiles(path, predicate)
      : predicate(path) ? [path] : [];
  });
};

const tagElements = (html, tagName) =>
  html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? [];

const attribute = (element, name) => {
  const match = element.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3];
};

const elementsByAttribute = (html, tagName, name, value) =>
  tagElements(html, tagName).filter((element) => attribute(element, name) === value);

const requireSingle = (items, route, label) => {
  if (items.length !== 1) {
    failures.push(`${route} must contain exactly one ${label}; found ${items.length}`);
    return undefined;
  }
  return items[0];
};

const requireAttribute = (element, name, route, label) => {
  if (!element) return undefined;
  const value = attribute(element, name);
  if (!value) failures.push(`${route} ${label} must provide ${name}.`);
  return value;
};

const requireSiteUrl = (value, route, label) => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.origin !== siteOrigin) {
      failures.push(`${route} ${label} must use ${siteOrigin}: ${value}`);
    }
    return url;
  } catch {
    failures.push(`${route} ${label} must be an absolute HTTPS URL: ${value}`);
    return undefined;
  }
};

const jsonLdValues = (html, route) => {
  const values = [];
  const pattern = /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      values.push(JSON.parse(match[1]));
    } catch (error) {
      failures.push(`${route} contains invalid JSON-LD: ${error.message}`);
    }
  }
  return values;
};

if (!existsSync(dist)) {
  failures.push('Missing dist directory; run the Astro build first.');
}

const packageJson = JSON.parse(read(join(root, 'package.json')));
if (!packageJson.scripts?.build?.includes('verify:dist')) {
  failures.push('package.json build script must invoke verify:dist after Pagefind indexing.');
}

const htmlFiles = collectFiles(dist, (path) => path.endsWith('.html'));
const searchableRoutes = [];
const expectedTypes = new Set(['文章', '专题', '工具', '项目']);
const foundTypes = new Set();

for (const path of htmlFiles) {
  const html = read(path);
  const route = toRoute(path);

  if (route === '/search/' && html.includes('__VITE_PRELOAD__')) {
    failures.push('/search/ production script contains an unresolved Vite preload placeholder.');
  }

  const description = requireSingle(elementsByAttribute(html, 'meta', 'name', 'description'), route, 'description meta');
  const canonical = requireSingle(elementsByAttribute(html, 'link', 'rel', 'canonical'), route, 'canonical link');
  const ogTitle = requireSingle(elementsByAttribute(html, 'meta', 'property', 'og:title'), route, 'og:title meta');
  const ogDescription = requireSingle(elementsByAttribute(html, 'meta', 'property', 'og:description'), route, 'og:description meta');
  const ogUrl = requireSingle(elementsByAttribute(html, 'meta', 'property', 'og:url'), route, 'og:url meta');
  const ogImage = requireSingle(elementsByAttribute(html, 'meta', 'property', 'og:image'), route, 'og:image meta');
  const twitterCard = requireSingle(elementsByAttribute(html, 'meta', 'name', 'twitter:card'), route, 'twitter:card meta');
  const twitterTitle = requireSingle(elementsByAttribute(html, 'meta', 'name', 'twitter:title'), route, 'twitter:title meta');
  const twitterDescription = requireSingle(elementsByAttribute(html, 'meta', 'name', 'twitter:description'), route, 'twitter:description meta');
  const twitterImage = requireSingle(elementsByAttribute(html, 'meta', 'name', 'twitter:image'), route, 'twitter:image meta');

  void description;
  void ogTitle;
  void ogDescription;
  void twitterCard;
  void twitterTitle;
  void twitterDescription;
  const canonicalHref = requireAttribute(canonical, 'href', route, 'canonical link');
  const canonicalUrl = requireSiteUrl(canonicalHref, route, 'canonical');
  requireSiteUrl(requireAttribute(ogUrl, 'content', route, 'og:url meta'), route, 'og:url');
  requireSiteUrl(requireAttribute(ogImage, 'content', route, 'og:image meta'), route, 'og:image');
  requireSiteUrl(requireAttribute(twitterImage, 'content', route, 'twitter:image meta'), route, 'twitter:image');

  if (canonicalUrl && canonicalHref) {
    if (/[?#]/u.test(canonicalHref)) {
      failures.push(`${route} canonical must not contain a query or hash: ${canonicalUrl.href}`);
    }
    if (canonicalUrl.pathname !== new URL(route, siteOrigin).pathname) {
      failures.push(`${route} canonical must match generated route ${siteOrigin}${route}: ${canonicalUrl.href}`);
    }
  }

  const robots = elementsByAttribute(html, 'meta', 'name', 'robots');
  if (route === '/search/') {
    const robotsTag = requireSingle(robots, route, 'robots meta');
    if (attribute(robotsTag ?? '', 'content') !== 'noindex,follow') {
      failures.push('/search/ robots meta must be noindex,follow.');
    }
  } else if (robots.some((tag) => attribute(tag, 'content')?.includes('noindex'))) {
    failures.push(`${route} must not be noindex.`);
  }

  const schemas = jsonLdValues(html, route);
  const schemaTypes = new Set(schemas.map((schema) => schema?.['@type']));
  if (route === '/' && !schemaTypes.has('WebSite')) {
    failures.push('Homepage must contain WebSite JSON-LD.');
  }
  if (/^\/posts\/[^/]+\/$/.test(route)) {
    if (!schemaTypes.has('BlogPosting')) failures.push(`${route} must contain BlogPosting JSON-LD.`);
    if (!schemaTypes.has('BreadcrumbList')) failures.push(`${route} must contain BreadcrumbList JSON-LD.`);
  }

  if (html.includes('data-pagefind-body')) {
    searchableRoutes.push(route);
    const typeMatch = html.match(/data-pagefind-meta="type:([^"]+)"/);
    if (!typeMatch || !expectedTypes.has(typeMatch[1])) {
      failures.push(`${route} has missing or unknown Pagefind type metadata.`);
    } else {
      foundTypes.add(typeMatch[1]);
    }
  }
}

const detailRoots = ['posts', 'topics', 'projects', 'tools'];
const expectedSearchableRoutes = htmlFiles
  .map(toRoute)
  .filter((route) => detailRoots.some((rootName) => new RegExp(`^/${rootName}/[^/]+/$`).test(route)));

if (searchableRoutes.length !== expectedSearchableRoutes.length) {
  failures.push(`Pagefind body count must match generated detail pages: ${searchableRoutes.length}/${expectedSearchableRoutes.length}.`);
}
for (const route of expectedSearchableRoutes) {
  if (!searchableRoutes.includes(route)) failures.push(`Generated detail page is missing Pagefind body: ${route}`);
}
for (const type of expectedTypes) {
  if (!foundTypes.has(type)) failures.push(`Pagefind output is missing content type: ${type}`);
}

const publishedPostRoutes = expectedSearchableRoutes.filter((route) => route.startsWith('/posts/'));
const rssPath = join(dist, 'rss.xml');
if (!existsSync(rssPath)) {
  failures.push('Missing dist/rss.xml.');
} else {
  const rss = read(rssPath);
  const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
  if (items.length !== publishedPostRoutes.length) {
    failures.push(`RSS item count must match published post details: ${items.length}/${publishedPostRoutes.length}.`);
  }
  if (/<draft\b|draft\s*[:=]/i.test(rss)) failures.push('RSS must not contain a draft marker.');
  for (const route of publishedPostRoutes) {
    const link = `${siteOrigin}${route}`;
    if (!items.some((item) => item.includes(`<link>${link}</link>`))) {
      failures.push(`RSS is missing the published post link: ${link}`);
    }
  }
}

const sitemapIndexPath = join(dist, 'sitemap-index.xml');
const sitemapShards = collectFiles(dist, (path) => /sitemap-\d+\.xml$/.test(path));
if (!existsSync(sitemapIndexPath)) failures.push('Missing sitemap-index.xml.');
if (sitemapShards.length === 0) failures.push('Missing Sitemap shard.');
for (const path of [sitemapIndexPath, ...sitemapShards].filter(existsSync)) {
  if (read(path).includes('/search/')) failures.push(`${relative(dist, path)} must exclude /search/.`);
}

const robotsPath = join(dist, 'robots.txt');
if (!existsSync(robotsPath) || !read(robotsPath).includes(`Sitemap: ${siteOrigin}/sitemap-index.xml`)) {
  failures.push('robots.txt must declare the absolute sitemap-index URL.');
}

for (const path of [
  join(dist, 'pagefind/pagefind.js'),
  join(dist, 'pagefind/pagefind-entry.json'),
]) {
  if (!existsSync(path)) failures.push(`Missing Pagefind artifact: ${relative(dist, path)}`);
}
if (collectFiles(join(dist, 'pagefind/index'), (path) => path.endsWith('.pf_index')).length === 0) {
  failures.push('Missing Pagefind index fragment.');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Production artifacts verified: ${htmlFiles.length} HTML pages, ${publishedPostRoutes.length} RSS posts, ${searchableRoutes.length} searchable details.`);
