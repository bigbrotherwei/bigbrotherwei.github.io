# Phase 7 Search And SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add private static full-text search plus complete RSS, Sitemap, Canonical, social metadata, and structured-data publishing to the Astro blog.

**Architecture:** Astro remains the sole page generator. Pure TypeScript helpers own canonical URLs, JSON-LD, RSS item mapping, and search-result normalization; Pagefind runs only after `astro build` and writes its static Chinese index into `dist/pagefind`. `BaseLayout` centralizes page metadata, while content detail templates explicitly opt into Pagefind indexing.

**Tech Stack:** Astro 7.3.2, TypeScript 6.0.3, Pagefind 1.5.2, `@astrojs/rss` 4.0.19, `@astrojs/sitemap` 3.7.4, `lucide-astro` 0.556.0, Node 22 test runner, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-23-phase-7-search-seo-design.zh.md`

## Global Constraints

- The site remains fully static and deployable by the existing GitHub Pages Actions workflow.
- Search terms stay in the browser; do not add analytics, persistence, APIs, external search, or a service worker.
- Search indexes only published post details, topic details, tool details, and project details.
- Draft posts, list pages, archive, tags, about, and `/search/` must not enter the Pagefind index.
- Search results must render with DOM nodes and `textContent`; do not inject excerpts through `innerHTML`.
- Every HTML page gets one absolute Canonical URL and one complete social metadata set.
- `/search/` is `noindex,follow` and excluded from Sitemap.
- RSS includes only published posts and does not embed full Markdown HTML.
- Unknown personal details must not be invented in JSON-LD.
- The search page gets unique original desktop and mobile WebP artwork; do not copy third-party game assets.
- Pagefind, RSS, Sitemap, and Lucide versions are pinned through `package-lock.json`.

## Review Focus

- A title or description containing `</script><script>` must remain inert inside JSON-LD; Task 1 pins `<` escaping.
- A page URL with a query string or hash must canonicalize to one stable path-only URL; Task 1 pins both removals and trailing-slash stability.
- Fast consecutive searches must not let an older Pagefind response overwrite the latest query; Task 5 pins request-token behavior.
- A draft post must never appear in RSS or Pagefind output; Tasks 3 and 4 pin source filtering and generated artifacts.
- Missing Pagefind assets or browser import failure must produce a visible error state rather than a blank page; Tasks 5, 6, and 7 pin failure rendering and production output.

---

### Task 1: SEO Domain Helpers

**Files:**
- Create: `src/lib/seo.ts`
- Create: `tests/seo/seo.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: absolute site URL and page/content data supplied by Astro templates.
- Produces: `JsonLdValue`, concrete `WebsiteJsonLd`/`BlogPostingJsonLd`/`BreadcrumbListJsonLd` interfaces, `buildCanonicalUrl(site, path)`, `buildWebsiteJsonLd(input)`, `buildBlogPostingJsonLd(input)`, `buildBreadcrumbJsonLd(items)`, and `serializeJsonLd(value)`.

- [ ] **Step 1: Add the SEO test command and failing helper tests**

Add `verify:seo` to `package.json` and include it in `verify`:

```json
"verify:seo": "node --experimental-strip-types --test tests/seo/*.test.ts",
"verify": "npm run verify:assets && npm run verify:quotes && npm run verify:visual-background && npm run verify:content && npm run verify:discovery && npm run verify:tools && npm run verify:seo"
```

Create tests with these concrete assertions:

```ts
assert.equal(
  buildCanonicalUrl('https://bigbrotherwei.github.io', '/posts/hello/?from=nav#title').href,
  'https://bigbrotherwei.github.io/posts/hello/',
);
assert.equal(buildCanonicalUrl('https://bigbrotherwei.github.io/', '/').href, 'https://bigbrotherwei.github.io/');
assert.equal(serializeJsonLd({ name: '</script><script>alert(1)</script>' }).includes('</script>'), false);

const posting = buildBlogPostingJsonLd({
  site: 'https://bigbrotherwei.github.io',
  path: '/posts/hello/',
  title: 'Hello',
  description: 'Description',
  publishedAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-02T00:00:00.000Z'),
  tags: ['Astro', 'SEO'],
  imagePath: '/images/backgrounds/post.webp',
});
assert.equal(posting['@type'], 'BlogPosting');
assert.equal(posting.mainEntityOfPage, 'https://bigbrotherwei.github.io/posts/hello/');
assert.deepEqual(posting.keywords, ['Astro', 'SEO']);
assert.equal(posting.author.name, 'bigbrotherwei');
assert.equal(posting.image, 'https://bigbrotherwei.github.io/images/backgrounds/post.webp');

const breadcrumbs = buildBreadcrumbJsonLd([
  { name: '首页', path: '/' },
  { name: '文章', path: '/posts/' },
  { name: 'Hello', path: '/posts/hello/' },
], 'https://bigbrotherwei.github.io');
assert.deepEqual(breadcrumbs.itemListElement.map((item) => item.position), [1, 2, 3]);
```

- [ ] **Step 2: Run the SEO tests and observe RED**

Run: `npm run verify:seo`

Expected: FAIL because `src/lib/seo.ts` does not exist.

- [ ] **Step 3: Implement the typed helpers**

Use these public shapes:

```ts
export type JsonLdScalar = string | number | boolean | null;
export type JsonLdValue = JsonLdScalar | { readonly [key: string]: JsonLdValue } | readonly JsonLdValue[];

export const buildCanonicalUrl = (site: string | URL, path: string | URL): URL => {
  const url = new URL(path, site);
  url.search = '';
  url.hash = '';
  return url;
};

export const serializeJsonLd = (value: JsonLdValue): string =>
  JSON.stringify(value).replace(/</g, '\\u003c');
```

`buildWebsiteJsonLd` must emit `WebSite`, `zh-CN`, the canonical home URL, and the known author name/GitHub profile. `buildBlogPostingJsonLd` must emit ISO dates, absolute image and page URLs, tags, and no unknown fields. `buildBreadcrumbJsonLd` must assign positions starting at one.
Give each builder a concrete exported return interface so consumers and tests can access schema fields without unsafe casts; the interfaces must remain assignable to `JsonLdValue`.

- [ ] **Step 4: Run the focused and full tests**

Run: `npm run verify:seo && npm run verify`

Expected: all SEO cases pass; discovery remains 8/8 and tools remain 65/65.

- [ ] **Step 5: Commit**

```bash
git add package.json src/lib/seo.ts tests/seo/seo.test.ts
git commit -m "feat: add seo metadata helpers"
```

### Task 2: Shared Metadata And Article Structured Data

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/posts/[slug].astro`
- Create: `scripts/verify-seo-source.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 SEO helpers and existing `BackgroundKey` registry.
- Produces: one metadata contract for all pages through `BaseLayout` props and article JSON-LD on every published post detail.

- [ ] **Step 1: Create a failing source-contract verifier**

The verifier must require these tokens and fail until layout/pages are updated:

```js
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
```

Also assert that the homepage calls `buildWebsiteJsonLd`, and post details call both `buildBlogPostingJsonLd` and `buildBreadcrumbJsonLd` while setting `pageType="article"`.

Update `verify:seo`:

```json
"verify:seo": "node --experimental-strip-types --test tests/seo/*.test.ts && node scripts/verify-seo-source.mjs"
```

- [ ] **Step 2: Run the source verifier and observe RED**

Run: `npm run verify:seo`

Expected: FAIL listing missing canonical/social/JSON-LD contracts.

- [ ] **Step 3: Extend `BaseLayout`**

Add the exact optional props from the spec. Compute:

```ts
const canonicalUrl = buildCanonicalUrl(Astro.site ?? 'https://bigbrotherwei.github.io', canonicalPath ?? Astro.url);
const socialImageUrl = buildCanonicalUrl(Astro.site ?? 'https://bigbrotherwei.github.io', background.desktop);
const jsonLdItems = structuredData ? (Array.isArray(structuredData) ? structuredData : [structuredData]) : [];
```

Render one canonical, robots, Open Graph, Twitter Card, RSS discovery, Sitemap discovery, and safely serialized JSON-LD script per item. Keep existing image preloads and title behavior intact.

- [ ] **Step 4: Add homepage and article schemas**

Homepage passes `buildWebsiteJsonLd`. Each article detail builds and passes:

```ts
const structuredData = [
  buildBlogPostingJsonLd({
    site: Astro.site!,
    path: `/posts/${post.id}/`,
    title: post.data.title,
    description: post.data.description,
    publishedAt: post.data.pubDate,
    updatedAt: post.data.updatedDate,
    tags: post.data.tags,
    imagePath: pageBackgrounds[post.data.background].desktop,
  }),
  buildBreadcrumbJsonLd([
    { name: '首页', path: '/' },
    { name: '文章', path: '/posts/' },
    { name: post.data.title, path: `/posts/${post.id}/` },
  ], Astro.site!),
];
```

- [ ] **Step 5: Verify source contracts and Astro types**

Run: `npm run verify:seo && npm run astro -- check && npm run build`

Expected: verifier passes, Astro reports 0 diagnostics, existing 29-page build remains green.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/verify-seo-source.mjs src/layouts/BaseLayout.astro src/pages/index.astro src/pages/posts/[slug].astro
git commit -m "feat: publish canonical and structured metadata"
```

### Task 3: RSS, Sitemap, And Robots

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `astro.config.mjs`
- Create: `src/lib/feed.ts`
- Create: `tests/seo/feed.test.ts`
- Create: `src/pages/rss.xml.ts`
- Create: `src/pages/robots.txt.ts`
- Modify: `scripts/verify-seo-source.mjs`

**Interfaces:**
- Consumes: published post collection and configured Astro `site` URL.
- Produces: `buildRssItems(posts)`, `/rss.xml`, `/robots.txt`, `sitemap-index.xml`, and sitemap shards.

- [ ] **Step 1: Install exact official integrations**

Run:

```bash
npm install @astrojs/rss@4.0.19 @astrojs/sitemap@3.7.4
```

Expected: lockfile records both packages without audit vulnerabilities.

- [ ] **Step 2: Write failing feed-mapping tests**

Tests must prove drafts are excluded, posts sort newest first, tags become categories, and links end with `/posts/<id>/`:

```ts
const items = buildRssItems([
  post('older', '2026-09-01', false, ['Astro']),
  post('draft', '2026-09-03', true, ['Hidden']),
  post('newer', '2026-09-02', false, ['SEO', 'RSS']),
]);
assert.deepEqual(items.map((item) => item.link), ['/posts/newer/', '/posts/older/']);
assert.deepEqual(items[0]?.categories, ['SEO', 'RSS']);
```

- [ ] **Step 3: Run feed tests and observe RED**

Run: `npm run verify:seo`

Expected: FAIL because `buildRssItems` is missing.

- [ ] **Step 4: Implement feed mapping and endpoints**

`buildRssItems` returns title, description, `pubDate`, link, and categories. `rss.xml.ts` calls `getCollection('posts')`, then:

```ts
return rss({
  title: 'bigbrotherwei',
  description: 'bigbrotherwei 的技术文章、学习记录和阶段性思考。',
  site: context.site!,
  items: buildRssItems(posts),
  customData: '<language>zh-CN</language>',
});
```

`robots.txt.ts` must return UTF-8 plain text with `User-agent: *`, `Allow: /`, and an absolute `Sitemap:` line built from `context.site`.

- [ ] **Step 5: Configure Sitemap exclusions**

Configure `@astrojs/sitemap` in `astro.config.mjs` and exclude only the canonical `/search/` URL. Disable unused news/video/xhtml/image namespaces to keep output focused.

- [ ] **Step 6: Extend source verification and build**

Require the RSS route, robots route, sitemap integration, `draft` filtering, `zh-CN`, and `/search/` filter. Run:

`npm run verify:seo && npm run build`

Expected: feed tests and source contracts pass; build emits `rss.xml`, `robots.txt`, `sitemap-index.xml`, and a sitemap shard.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json astro.config.mjs scripts/verify-seo-source.mjs src/lib/feed.ts tests/seo/feed.test.ts src/pages/rss.xml.ts src/pages/robots.txt.ts
git commit -m "feat: add rss sitemap and robots publishing"
```

### Task 4: Pagefind Build Pipeline And Index Boundaries

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/pages/posts/[slug].astro`
- Modify: `src/pages/topics/[slug].astro`
- Modify: `src/pages/projects/[slug].astro`
- Modify: `src/components/tools/ToolLayout.astro`
- Modify: `scripts/verify-seo-source.mjs`

**Interfaces:**
- Consumes: generated `dist/` HTML and content-detail templates.
- Produces: one searchable document for every published post, topic, project, and tool detail page, plus `dist/pagefind/pagefind.js` and index chunks. The current seed baseline is 12 documents, but verification must derive the expected total from generated searchable HTML so future content additions do not break the build.

- [ ] **Step 1: Install Pagefind and write failing boundary assertions**

Run: `npm install --save-dev pagefind@1.5.2`

Extend the source verifier to require:

```js
const searchableTemplates = new Map([
  ['src/pages/posts/[slug].astro', 'type:文章'],
  ['src/pages/topics/[slug].astro', 'type:专题'],
  ['src/pages/projects/[slug].astro', 'type:项目'],
  ['src/components/tools/ToolLayout.astro', 'type:工具'],
]);
```

Each must include `data-pagefind-body` and its exact `data-pagefind-meta` type. Assert `/search/`, list routes, archive, tag, and about sources do not contain `data-pagefind-body`.

- [ ] **Step 2: Run verifier and observe RED**

Run: `npm run verify:seo`

Expected: FAIL for all four missing Pagefind boundaries.

- [ ] **Step 3: Mark only searchable content**

For posts, topics, and projects, mark the detail header and rendered Markdown body as the searchable body while keeping related/navigation sections outside it. Put `data-pagefind-meta="type:文章"`, `type:专题`, or `type:项目` on the corresponding heading/header.

In `ToolLayout`, wrap `PageHero` and the privacy description in one `data-pagefind-body` container with `data-pagefind-meta="type:工具"`; leave the interactive workspace and live status outside the index.

- [ ] **Step 4: Add deterministic build scripts**

Use this script structure:

```json
"build:astro": "npm run verify && ASTRO_TELEMETRY_DISABLED=1 astro check && ASTRO_TELEMETRY_DISABLED=1 astro build",
"index:search": "pagefind --site dist",
"build": "npm run build:astro && npm run index:search"
```

- [ ] **Step 5: Build and inspect Pagefind output**

Run: `npm run build`

Expected: Pagefind reports 12 indexed pages; `dist/pagefind/pagefind.js`, metadata, fragment, and index files exist. No draft or list route is reported as indexed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/verify-seo-source.mjs src/pages/posts/[slug].astro src/pages/topics/[slug].astro src/pages/projects/[slug].astro src/components/tools/ToolLayout.astro
git commit -m "feat: generate private static search index"
```

### Task 5: Search Domain And Browser Controller

**Files:**
- Create: `src/lib/search.ts`
- Create: `tests/search/search.test.ts`
- Create: `src/scripts/search-page.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Pagefind search result data shaped as `{ url, plain_excerpt, meta }`.
- Produces: `SearchViewResult`, `toSearchViewResult(data)`, `createSearchRequestGuard()`, and `mountSearchPage(document, loadPagefind)`.

- [ ] **Step 1: Add search tests and the search test command**

Add:

```json
"verify:search": "node --experimental-strip-types --test tests/search/*.test.ts"
```

Append `npm run verify:search` to `verify`.

Tests must assert:

```ts
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

const guard = createSearchRequestGuard();
const first = guard.begin();
const second = guard.begin();
assert.equal(guard.isCurrent(first), false);
assert.equal(guard.isCurrent(second), true);
```

Also cover blank title/type fallbacks and rejection of non-root-relative result URLs.

- [ ] **Step 2: Run search tests and observe RED**

Run: `npm run verify:search`

Expected: FAIL because `src/lib/search.ts` does not exist.

- [ ] **Step 3: Implement pure search normalization and request guard**

Use immutable result objects, preserve `plain_excerpt` literally for later `textContent`, and throw on result URLs that do not begin with `/`.

- [ ] **Step 4: Implement the browser controller**

`mountSearchPage` must:

- Locate required elements by `data-search-*` attributes and throw a clear setup error if missing.
- Lazy-load `/pagefind/pagefind.js` only after focus or non-empty input.
- Debounce input by 180 ms.
- Increment the request guard before each query and ignore stale results.
- Load at most 20 result data records.
- Build `<article>`, `<a>`, `<span>`, `<h2>`, and `<p>` with `createElement` and `textContent` only.
- Switch among idle, loading, results, empty, and error states through existing fixed containers and `aria-live` status text.

The default page loader must use `import(/* @vite-ignore */ '/pagefind/pagefind.js')`; tests inject a fake loader and never require generated Pagefind files.

- [ ] **Step 5: Run focused and full verification**

Run: `npm run verify:search && npm run verify && npm run astro -- check`

Expected: all search tests and existing suites pass with 0 Astro diagnostics.

- [ ] **Step 6: Commit**

```bash
git add package.json src/lib/search.ts src/scripts/search-page.ts tests/search/search.test.ts
git commit -m "feat: add safe browser search controller"
```

### Task 6: Search Page, Navigation, And Original Artwork

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/components/SiteNav.astro`
- Create: `src/pages/search/index.astro`
- Modify: `src/data/backgrounds.ts`
- Modify: `src/styles/global.css`
- Modify: `scripts/verify-visual-background.mjs`
- Modify: `scripts/verify-seo-source.mjs`
- Create: `public/images/backgrounds/search-index.webp`
- Create: `public/images/backgrounds/search-index-mobile.webp`

**Interfaces:**
- Consumes: Task 5 `mountSearchPage`, Pagefind production assets, existing `PageHero`, and background registry.
- Produces: accessible `/search/`, fixed-size Lucide navigation entry, and one unique responsive search background pair.

- [ ] **Step 1: Install Lucide and add failing page contracts**

Run: `npm install lucide-astro@0.556.0`

Extend static verifiers to require:

- `Search` imported from `lucide-astro`.
- One `/search/` link with `aria-label="搜索"` and a hover title.
- Search page `robots="noindex,follow"`, `backgroundKey="search-index"`, `<noscript>`, labeled search input, result summary, result container, empty state, and error state.
- No `innerHTML` in the page or search script.
- `search-index` registered in the background registry and visual verifier.

Run: `npm run verify:seo && npm run verify:visual-background`

Expected: FAIL because the page, assets, and registry entry do not exist.

- [ ] **Step 2: Generate and inspect original artwork**

Use the image generation skill to create an original hand-painted nighttime woodland reading kiosk/library scene with modest game-art texture, warm windows, a visible path, trees, and grounded real-world proportions. Do not request or reproduce copyrighted game characters, UI, buildings, or map tiles.

Create and inspect:

- Desktop `1672 x 941` WebP at `public/images/backgrounds/search-index.webp`.
- Mobile `941 x 1672` WebP at `public/images/backgrounds/search-index-mobile.webp`.

Both files must be 80 KB–1 MB and remain readable behind the existing overlay.

- [ ] **Step 3: Register the background and build the page**

Add `search-index` to `backgroundKeys` and `pageBackgrounds`. Build `/search/` with one unframed page band, `PageHero`, a single search panel, stable result dimensions, and the fixed status containers required by Task 5. Call `mountSearchPage(document)` from the page script.

- [ ] **Step 4: Add the navigation icon and responsive styles**

Use Lucide `Search` inside a fixed `2.25rem` square link. Keep text links unchanged, add a familiar hover tooltip through `title`, and ensure the icon link wraps cleanly with the existing mobile navigation.

Search styles must use existing color tokens, maximum `8px` radii, no nested cards, no decorative gradients or blobs, visible focus, `overflow-wrap: anywhere`, and stable loading/empty/error blocks.

- [ ] **Step 5: Verify source, visual, types, and build**

Run:

```bash
npm run verify:seo
npm run verify:visual-background
npm run verify:search
npm run astro -- check
npm run build
```

Expected: all commands pass; Astro emits `/search/`; the current seed content produces 12 searchable detail pages, with the verifier deriving that count instead of hard-coding it.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/SiteNav.astro src/pages/search/index.astro src/data/backgrounds.ts src/styles/global.css scripts/verify-visual-background.mjs scripts/verify-seo-source.mjs public/images/backgrounds/search-index.webp public/images/backgrounds/search-index-mobile.webp
git commit -m "feat: add illustrated static search experience"
```

### Task 7: Production Artifact Verification, Documentation, And QA

**Files:**
- Create: `scripts/verify-dist.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/writing-posts.zh.md`
- Create: `docs/qa/phase-7-search-seo.md`

**Interfaces:**
- Consumes: complete Astro output, Sitemap/RSS endpoints, Pagefind bundle, and all Phase 7 pages.
- Produces: a build that fails on incomplete publishing metadata plus PR-ready verification evidence.

- [ ] **Step 1: Write the failing production verifier**

The verifier recursively inspects `dist/**/*.html` and must enforce:

- Exactly one canonical, description, `og:title`, `og:description`, `og:url`, `og:image`, `twitter:card`, `twitter:title`, `twitter:description`, and `twitter:image` per HTML page.
- All canonical/social URLs are absolute HTTPS URLs on `bigbrotherwei.github.io`.
- Search HTML has `noindex,follow`; no other HTML has `noindex`.
- Homepage has `WebSite`; every generated post detail has `BlogPosting` and `BreadcrumbList`; all JSON-LD parses after reading script text.
- `rss.xml` item count matches the published post details discovered in generated output, contains no draft marker, and uses absolute post links.
- Sitemap index/shard exist and do not contain `/search/`.
- `robots.txt` declares `https://bigbrotherwei.github.io/sitemap-index.xml`.
- `dist/pagefind/pagefind.js`, its entry manifest, and at least one index fragment exist.
- The number of generated HTML files containing `data-pagefind-body` matches the expected published detail pages derived from output, and all four expected `type` values occur. Treat Pagefind's current CLI report of 12 indexed pages as QA evidence, not a permanent hard-coded artifact assertion.

The verifier must also inspect `package.json` and require the production `build` script to invoke `verify:dist`.

Run: `node scripts/verify-dist.mjs`

Expected: FAIL because the production `build` script does not invoke `verify:dist` yet, with explicit messages for any other unmet artifact contract.

- [ ] **Step 2: Integrate post-build verification**

Add:

```json
"verify:dist": "node scripts/verify-dist.mjs",
"build": "npm run build:astro && npm run index:search && npm run verify:dist"
```

Implement the checks with `node:fs`, `node:path`, and structured parsing where possible. Do not validate XML or HTML with one giant regular expression; isolate tag extraction helpers and parse JSON-LD with `JSON.parse`.

- [ ] **Step 3: Run the complete clean verification sequence**

Run:

```bash
npm run verify
npm run astro -- check
npm run build
git diff --check
```

Expected: all suites pass, 0 Astro diagnostics, the current baseline of 30 HTML pages plus RSS/robots/Sitemap outputs, the current Pagefind CLI report of 12 indexed pages, and no whitespace errors. Permanent verification derives content totals so later posts/topics/projects/tools can increase them safely.

- [ ] **Step 4: Update Chinese maintenance documentation**

README must document `/search/`, `/rss.xml`, Sitemap/robots, Phase 7 scope, the Pagefind post-build step, and Phase 8 dynamic-experience placeholder. Writing guide must explain how title, description, date, tags, draft, and background flow into search/RSS/SEO, plus the final `npm run build` requirement.

- [ ] **Step 5: Run production browser QA**

Start `npm run preview -- --host 127.0.0.1`. In the in-app browser:

- Desktop `1440 x 900`: search `Astro`, `博客`, `JSON`, and `个人博客`; confirm article/topic/tool/project hits.
- Mobile `390 x 844`: repeat one Chinese search and inspect navigation wrap, portrait art, focus, result text, and horizontal overflow.
- Check blank input, no result, query replacement, and result navigation.
- Temporarily block or rename the Pagefind resource in browser context to confirm the visible error state; do not commit fixture changes.
- Inspect console for 0 errors on successful flows.
- Open `/rss.xml`, `/sitemap-index.xml`, `/robots.txt`, homepage, and one article head.

Record commit, commands, viewports, queries, result types, metadata checks, console status, and repaired defects in `docs/qa/phase-7-search-seo.md`.

- [ ] **Step 6: Final review and commit**

Run:

```bash
git status --short
git diff origin/master...HEAD --stat
npm run build
```

Commit only Phase 7 files:

```bash
git add package.json README.md docs/writing-posts.zh.md docs/qa/phase-7-search-seo.md scripts/verify-dist.mjs
git commit -m "docs: complete phase seven publishing qa"
```

- [ ] **Step 7: Push and create the pull request**

Push `codex/phase-7-search-seo-20260923`, create a PR targeting `master`, wait for the PR workflow, and report the URL plus post-merge checks for `/search/`, `/rss.xml`, `/sitemap-index.xml`, and `/robots.txt`.
