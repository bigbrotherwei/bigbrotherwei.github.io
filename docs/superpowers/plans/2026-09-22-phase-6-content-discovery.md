# Phase 6 Content Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Markdown-managed projects, article archive and tag browsing, deterministic adjacent/related article navigation, improved project/about content, and responsive hand-painted backgrounds.

**Architecture:** Astro Content Collections remain the source of truth. Pure TypeScript discovery helpers derive archive, tag, adjacent, and related-post data at build time; Astro routes consume those helpers without client-side fetching. Project content becomes a third collection and every hand-authored detail page continues to select a validated unique background.

**Tech Stack:** Astro 7, TypeScript 6, Markdown Content Collections, Node test runner, static GitHub Pages output, responsive WebP artwork.

**Spec:** `docs/superpowers/specs/2026-09-22-phase-6-content-discovery-design.zh.md`

## Global Constraints

- Phase 6 excludes Pagefind, RSS, Sitemap, Canonical, structured data, categories, comments, analytics, online presence, CMS, and backend services.
- Draft posts must not appear in archive, tags, adjacent navigation, or related recommendations.
- Related posts score same-topic matches at 100 points and each shared tag at 10 points; zero-score posts are excluded and at most three results are returned.
- Tag slugs use Unicode NFKC normalization, lowercase text, hyphenated whitespace, and retain only letters, numbers, Han characters, and hyphens.
- Hand-authored post, topic, and project detail pages must use unique registered background keys.
- New artwork must be original hand-painted farm-at-dusk imagery, not copied third-party game assets.
- Desktop backgrounds are at least 1600 x 900; mobile backgrounds are at least 720 x 1280; both use WebP and satisfy the existing size verifier.
- All content and visible interface copy are Chinese-first.

## Review Focus

- Two distinct labels that normalize to one tag slug must fail validation instead of overwriting a route; Task 1 adds the collision test.
- Posts with equal publication dates must keep deterministic slug order; Task 1 adds the stable-sort test.
- One-post and first/last-post collections must return missing adjacent links cleanly; Task 1 adds boundary tests.
- Posts sharing neither topic nor tags must not appear as filler recommendations; Task 1 adds a zero-score test.
- Very long Chinese/English tag labels must wrap without widening cards or overflowing mobile pages; Task 7 includes browser checks at 390 x 844.

---

### Task 1: Pure Content Discovery Helpers

**Files:**
- Create: `src/lib/content/discovery.ts`
- Create: `tests/content/discovery.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: post-like objects with `id`, `data.title`, `data.description`, `data.pubDate`, `data.tags`, `data.topic`, and `data.draft`.
- Produces: `sortPostsByDate`, `buildArchiveGroups`, `toTagSlug`, `buildTagIndex`, `findAdjacentPosts`, and `findRelatedPosts`.

- [ ] **Step 1: Write failing discovery tests**

Create fixtures with published and draft posts, then assert the public contracts:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArchiveGroups,
  buildTagIndex,
  findAdjacentPosts,
  findRelatedPosts,
  sortPostsByDate,
  toTagSlug,
} from '../../src/lib/content/discovery.ts';

const post = (id: string, date: string, tags: string[], topic = 'journal', draft = false) => ({
  id,
  data: {
    title: id,
    description: `${id} description`,
    pubDate: new Date(`${date}T00:00:00.000Z`),
    tags,
    topic,
    draft,
  },
});

test('normalizes Chinese and English labels into stable slugs', () => {
  assert.equal(toTagSlug(' GitHub  Pages '), 'github-pages');
  assert.equal(toTagSlug('博客重构'), '博客重构');
});

test('rejects distinct labels that collide after normalization', () => {
  assert.throws(() => buildTagIndex([
    post('one', '2026-09-01', ['GitHub Pages']),
    post('two', '2026-09-02', ['github   pages']),
  ]), /标签 slug 冲突/);
});

test('sorts equal dates deterministically and excludes drafts from archives', () => {
  const posts = [
    post('zeta', '2026-09-10', []),
    post('alpha', '2026-09-10', []),
    post('draft', '2026-10-01', [], 'journal', true),
  ];
  assert.deepEqual(sortPostsByDate(posts).map(({ id }) => id), ['alpha', 'zeta']);
  assert.deepEqual(buildArchiveGroups(posts).map(({ year }) => year), [2026]);
});

test('returns explicit older and newer neighbors at collection boundaries', () => {
  const posts = [post('new', '2026-09-03', []), post('middle', '2026-09-02', []), post('old', '2026-09-01', [])];
  assert.deepEqual(findAdjacentPosts(posts, 'middle'), { older: posts[2], newer: posts[0] });
  assert.equal(findAdjacentPosts(posts, 'new').newer, undefined);
  assert.equal(findAdjacentPosts([posts[0]], 'new').older, undefined);
});

test('ranks shared topic and tags while excluding current, draft, and zero-score posts', () => {
  const current = post('current', '2026-09-01', ['Astro'], 'build');
  const sameTopic = post('topic', '2026-08-01', [], 'build');
  const sameTag = post('tag', '2026-09-03', ['Astro'], 'other');
  const unrelated = post('none', '2026-09-04', ['CSS'], 'other');
  const draft = post('draft', '2026-09-05', ['Astro'], 'build', true);
  assert.deepEqual(findRelatedPosts([current, sameTag, unrelated, sameTopic, draft], current).map(({ id }) => id), ['topic', 'tag']);
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `node --experimental-strip-types --test tests/content/discovery.test.ts`

Expected: FAIL because `src/lib/content/discovery.ts` does not exist.

- [ ] **Step 3: Implement focused discovery helpers**

Define exported structural types so Astro collection entries satisfy them without importing `astro:content`. Filter drafts at every public aggregation boundary, use UTC year/month extraction for deterministic builds, and return immutable result objects. `buildTagIndex` must retain the first display label and throw when a later distinct label maps to the same slug.

- [ ] **Step 4: Add the discovery suite to verification**

Add:

```json
"verify:discovery": "node --experimental-strip-types --test tests/content/*.test.ts"
```

Insert `npm run verify:discovery` into `verify` before existing tool tests.

- [ ] **Step 5: Run discovery and full verification**

Run: `npm run verify:discovery && npm run verify`

Expected: all discovery tests and the existing 65 tool tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json src/lib/content/discovery.ts tests/content/discovery.test.ts
git commit -m "feat: add content discovery helpers"
```

### Task 2: Project Collection And Seed Content

**Files:**
- Modify: `src/content.config.ts`
- Create: `src/content/projects/bigbrotherwei-github-io.md`
- Modify: `scripts/verify-content.mjs`
- Modify: `tests/content/discovery.test.ts`

**Interfaces:**
- Consumes: `backgroundKeys` from `src/data/backgrounds.ts`.
- Produces: Astro collection `projects` with validated project frontmatter and seed entry id `bigbrotherwei-github-io`.

- [ ] **Step 1: Extend static content verification first**

Require `src/content/projects`, project frontmatter keys, valid status values, valid HTTP(S) URLs, and one seed project. Require `src/content.config.ts` to register the projects loader and schema.

- [ ] **Step 2: Run the verifier and confirm failure**

Run: `npm run verify:content`

Expected: FAIL for the missing projects collection and seed content.

- [ ] **Step 3: Add the projects collection schema**

Add a `projects` collection with:

```ts
schema: z.object({
  title: z.string(),
  description: z.string(),
  status: z.enum(['维护中', '实验中', '已完成', '已归档']),
  startDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  order: z.number().int(),
  repository: z.string().url().optional(),
  website: z.string().url().optional(),
  background: z.enum(backgroundKeys),
})
```

Export `collections = { posts, topics, projects }`.

- [ ] **Step 4: Add the blog project Markdown**

Create Chinese content describing the Astro stack, feature-branch/PR workflow, completed phases, current content capabilities, and future search/SEO/statistics directions. Use only known repository facts. Set the repository and website to the public GitHub repository and GitHub Pages site.

- [ ] **Step 5: Run content validation and Astro check**

Run: `npm run verify:content && npm run astro -- check`

Expected: PASS with zero Astro diagnostics.

- [ ] **Step 6: Commit**

```bash
git add src/content.config.ts src/content/projects scripts/verify-content.mjs tests/content/discovery.test.ts
git commit -m "feat: add markdown project collection"
```

### Task 3: Project Pages And Project Detail Artwork

**Files:**
- Modify: `src/pages/projects/index.astro`
- Create: `src/pages/projects/[slug].astro`
- Create: `public/images/backgrounds/project-personal-blog.webp`
- Create: `public/images/backgrounds/project-personal-blog-mobile.webp`
- Modify: `src/data/backgrounds.ts`
- Modify: `scripts/verify-content.mjs`

**Interfaces:**
- Consumes: Astro `projects` collection and project entry background key.
- Produces: static project list and detail routes.

- [ ] **Step 1: Add failing page-contract checks**

Require the project index to call `getCollection('projects')`, render `/projects/${project.id}/`, and expose status/tags. Require the detail route to export `getStaticPaths`, call `render(project)`, pass `project.data.background` to `BaseLayout`, and render repository/website links conditionally.

- [ ] **Step 2: Run the content verifier and confirm failure**

Run: `npm run verify:content`

Expected: FAIL because the project detail route and collection-driven index are absent.

- [ ] **Step 3: Generate the original responsive project artwork**

Generate a detailed hand-painted dusk scene of a lakeside timber workshop with a warm glowing drafting desk, pinned site maps, garden paths, trees, water, and subtle game-art texture. Keep an uncluttered dark text-safe area through the center-left. Produce separate desktop and portrait mobile compositions, convert to WebP if necessary, and register `project-personal-blog`.

- [ ] **Step 4: Implement collection-driven project pages**

Sort projects by `featured` descending, `order` ascending, then `startDate` descending. Render compact cards on the index. On detail pages render status, dates, tags, safe external links, and Markdown body using the existing article typography without nesting cards.

- [ ] **Step 5: Run route, background, and build checks**

Run: `npm run verify:content && npm run verify:visual-background && npm run build`

Expected: project list and `/projects/bigbrotherwei-github-io/` build successfully and all background checks pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/projects src/data/backgrounds.ts public/images/backgrounds/project-personal-blog*.webp scripts/verify-content.mjs
git commit -m "feat: add project detail experience"
```

### Task 4: Archive And Tag Routes With Artwork

**Files:**
- Create: `src/components/PostsSubnav.astro`
- Create: `src/pages/archive/index.astro`
- Create: `src/pages/tags/index.astro`
- Create: `src/pages/tags/[slug].astro`
- Modify: `src/pages/posts/index.astro`
- Create: `public/images/backgrounds/archive-index.webp`
- Create: `public/images/backgrounds/archive-index-mobile.webp`
- Create: `public/images/backgrounds/tags-index.webp`
- Create: `public/images/backgrounds/tags-index-mobile.webp`
- Create: `public/images/backgrounds/tag-detail.webp`
- Create: `public/images/backgrounds/tag-detail-mobile.webp`
- Modify: `src/data/backgrounds.ts`
- Modify: `scripts/verify-content.mjs`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `buildArchiveGroups`, `buildTagIndex`, and published posts.
- Produces: `/archive/`, `/tags/`, every `/tags/[slug]/`, and reusable posts subnavigation.

- [ ] **Step 1: Add failing archive/tag route contracts**

Require all three route files, the two discovery helper calls, generated tag paths, post links, empty-state copy, and `PostsSubnav` links for `/posts/`, `/archive/`, and `/tags/`.

- [ ] **Step 2: Run verification and confirm missing-route failures**

Run: `npm run verify:content`

Expected: FAIL for missing archive, tags, and subnavigation contracts.

- [ ] **Step 3: Generate three original responsive background pairs**

Generate matching hand-painted dusk scenes: a moonlit rural station archive wall for archive, a greenhouse seed-label rack for tag index, and a forest signpost at branching paths for tag details. Preserve the established detailed illustration style and separate text-safe zones for desktop and portrait mobile crops.

- [ ] **Step 4: Implement the posts subnavigation and archive page**

The subnavigation uses three text links and `aria-current="page"` for the active route. Archive groups render year headings, localized month headings, exact dates, titles, descriptions, and linked tags in descending date order.

- [ ] **Step 5: Implement tag index and dynamic tag pages**

Tag index sorts by article count descending then display label. `getStaticPaths` builds one page per normalized tag slug. Each detail page renders its original label, count, and descending article list. All pages filter drafts before calling helpers.

- [ ] **Step 6: Add stable responsive styles**

Use full-width unframed year sections, compact article rows, wrapping tag links, visible keyboard focus, and mobile-safe grid tracks. Do not add nested cards or viewport-width font scaling.

- [ ] **Step 7: Run discovery, content, background, and build checks**

Run: `npm run verify:discovery && npm run verify:content && npm run verify:visual-background && npm run build`

Expected: all tag routes and archive route appear in Astro's generated route list.

- [ ] **Step 8: Commit**

```bash
git add src/components/PostsSubnav.astro src/pages/archive src/pages/tags src/pages/posts/index.astro src/styles/global.css src/data/backgrounds.ts public/images/backgrounds/archive-index*.webp public/images/backgrounds/tags-index*.webp public/images/backgrounds/tag-detail*.webp scripts/verify-content.mjs
git commit -m "feat: add archive and tag browsing"
```

### Task 5: Article Navigation And Recommendations

**Files:**
- Modify: `src/pages/posts/[slug].astro`
- Modify: `src/styles/global.css`
- Modify: `scripts/verify-content.mjs`

**Interfaces:**
- Consumes: `buildTagIndex`, `findAdjacentPosts`, `findRelatedPosts`, and all published posts.
- Produces: linked article tags, older/newer navigation, related-post cards, and secondary content navigation.

- [ ] **Step 1: Add failing article-detail contracts**

Require imports and calls for all three helpers, tag links beginning `/tags/`, labels `更早一篇` and `更新一篇`, related section label `相关推荐`, and absence of a placeholder when the recommendation list is empty.

- [ ] **Step 2: Run verification and confirm failure**

Run: `npm run verify:content`

Expected: FAIL because article tags are spans and navigation/recommendations are absent.

- [ ] **Step 3: Implement article discovery data flow**

Fetch posts once, filter drafts, use the same array for paths and derived relationships, and create a tag lookup by display label. Compute relationships after resolving the current post. Keep topic lookup unchanged.

- [ ] **Step 4: Render accessible navigation and recommendations**

Convert tags to anchors. Render older/newer links only when values exist. Render recommendations only when non-empty and identify the section with a heading. Use concise cards containing title, description, date, and relationship metadata without nested cards.

- [ ] **Step 5: Add responsive styles and run checks**

Run: `npm run verify:content && npm run astro -- check && npm run build`

Expected: zero diagnostics and all article detail routes build with valid tag links.

- [ ] **Step 6: Commit**

```bash
git add src/pages/posts/[slug].astro src/styles/global.css scripts/verify-content.mjs
git commit -m "feat: add article discovery navigation"
```

### Task 6: About Page And Maintenance Documentation

**Files:**
- Modify: `src/pages/about.astro`
- Modify: `README.md`
- Modify: `docs/writing-posts.zh.md`
- Modify: `scripts/verify-content.mjs`

**Interfaces:**
- Consumes: known repository, deployment, and content workflow facts.
- Produces: accurate public about content and contributor guidance for projects, tags, and archive behavior.

- [ ] **Step 1: Add failing documentation checks**

Require README headings or phrases for `第六阶段范围`, `创建新项目`, `文章归档`, and `标签页面`. Require the writing guide to explain tag URL generation and collision avoidance.

- [ ] **Step 2: Run verification and confirm documentation failure**

Run: `npm run verify:content`

Expected: FAIL for missing Phase 6 maintenance documentation.

- [ ] **Step 3: Improve about content without inventing identity data**

Add sections for current focus, the site's technology/maintenance model, shipped capabilities, and next steps. Link only to the known GitHub profile and repository. Remove copy that still describes completed tools or content features as future placeholders.

- [ ] **Step 4: Document authoring and derived pages**

Explain project file location, complete project frontmatter, unique project background requirements, automatic archive/tag generation, tag naming stability, and the verification commands contributors must run.

- [ ] **Step 5: Run content and full verification**

Run: `npm run verify:content && npm run verify`

Expected: all static contracts and unit tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/about.astro README.md docs/writing-posts.zh.md scripts/verify-content.mjs
git commit -m "docs: document phase six content workflows"
```

### Task 7: Full Verification And Visual QA

**Files:**
- Modify as required by verified defects only.
- Create: `docs/qa/phase-6-content-discovery.md`

**Interfaces:**
- Consumes: completed Phase 6 pages and production build.
- Produces: final verification evidence and a PR-ready branch.

- [ ] **Step 1: Run the complete clean verification sequence**

Run:

```bash
npm run verify
npm run astro -- check
npm run build
```

Expected: all commands exit 0, Astro reports zero diagnostics, and the generated route list includes project detail, archive, tag index, and every tag detail.

- [ ] **Step 2: Start production preview**

Run: `npm run preview -- --host 127.0.0.1`

Keep the server running through browser QA.

- [ ] **Step 3: Inspect desktop pages at 1440 x 900**

Check `/projects/`, `/projects/bigbrotherwei-github-io/`, `/archive/`, `/tags/`, every generated tag page, all three article details, `/posts/`, and `/about/`. Verify artwork loads, cards do not nest, tags wrap, article navigation is directional, external links work, and console output contains no errors.

- [ ] **Step 4: Inspect mobile pages at 390 x 844**

Repeat the key project, archive, tag, and article flows. Verify portrait backgrounds are used, fixed navigation does not cover content, long `GitHub Pages`/`GitHub Actions` tags wrap, and no element creates horizontal scrolling.

- [ ] **Step 5: Exercise keyboard and edge-state behavior**

Tab through post subnavigation, tags, adjacent links, related cards, project links, and main navigation. Confirm visible focus. Temporarily verify helper tests already cover one-post, no-related, collision, and draft exclusion states; do not commit temporary content.

- [ ] **Step 6: Record QA evidence**

Write the tested commit, commands, viewport sizes, routes, background checks, keyboard checks, console status, and any repaired defects to `docs/qa/phase-6-content-discovery.md`.

- [ ] **Step 7: Review branch diff and commit QA fixes**

Run: `git diff --check && git status --short && git diff origin/master...HEAD --stat`

Commit only verified Phase 6 files:

```bash
git add docs/qa/phase-6-content-discovery.md
git commit -m "test: record phase six visual qa"
```

- [ ] **Step 8: Push and create the pull request**

Push `codex/phase-6-content-discovery-20260922`, create a PR targeting `master`, summarize behavior and verification, then wait for GitHub Actions and report the PR URL plus post-merge Pages checks.
