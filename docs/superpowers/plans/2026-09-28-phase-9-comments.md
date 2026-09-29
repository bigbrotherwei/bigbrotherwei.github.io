# Phase 9 Article Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add click-to-load GitHub Discussions comments to article pages without affecting static publishing when Giscus is unconfigured.

**Architecture:** A small typed config helper maps public build variables to Giscus attributes; an article-only component owns the loading and failure states. A public privacy page explains the external request, and the Pages workflow passes public variables through the Astro build.

**Tech Stack:** Astro 7, TypeScript 6, Giscus, Node 22 test runner, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-28-phase-9-comments-analytics-design.zh.md`

## Global Constraints

- Comments appear only on article detail pages and load only after a click.
- Use strict `pathname` mapping; title edits must not remap comments.
- Only public repository/category identifiers enter the client; no GitHub token or app credential enters the repository.
- Missing Giscus config leaves article reading and Pages deployment functional.
- Keep the night hand-painted styling, keyboard accessibility, narrow-screen layout, and Pagefind exclusion.
- The final GitHub Discussions enablement and Giscus App installation require the repository owner's action.

## Review Focus

- A partial config must not inject `client.js` or a malformed iframe; Task 1 tests rejection.
- A title change must not change the mapped discussion; Task 1 tests pathname mapping.
- Repeated clicks must not add duplicate scripts; Task 2 tests single insertion.
- Script load failure must expose retry and a Discussions link; Task 2 tests the error state.
- The unconfigured build must still pass and expose an honest “评论未开放” state; Task 3 tests generated output.

---

### Task 1: Public Giscus Configuration

**Files:**
- Create: `src/lib/comments.ts`, `tests/comments/comments.test.ts`
- Modify: `package.json`, `src/env.d.ts`

**Interfaces:**
- Consumes: `PUBLIC_GISCUS_REPO`, `PUBLIC_GISCUS_REPO_ID`, `PUBLIC_GISCUS_CATEGORY`, `PUBLIC_GISCUS_CATEGORY_ID`.
- Produces: `type GiscusConfig`, `readGiscusConfig(env: Record<string, string | undefined>): GiscusConfig | null`, `giscusAttributes(config: GiscusConfig): Record<string, string>`.

- [ ] **Step 1: Write failing tests** in `tests/comments/comments.test.ts`: assert complete config yields `data-mapping=pathname`, `data-strict=1`, `data-lang=zh-CN`, and no title-based mapping or title-derived `data-term`; missing/blank fields return `null`.
- [ ] **Step 2: Verify RED** with `node --experimental-strip-types --test tests/comments/*.test.ts`; expect module-not-found or missing exports.
- [ ] **Step 3: Implement helpers** with the exact interfaces above; validate `owner/repo` and nonblank public IDs, return only Giscus-supported attributes, and add `verify:comments` to `package.json` and the aggregate `verify` script.
- [ ] **Step 4: Verify GREEN** with `npm run verify:comments`; expect all cases to pass.
- [ ] **Step 5: Commit** `git add src/lib/comments.ts tests/comments/comments.test.ts src/env.d.ts package.json && git commit -m "feat: validate public comment configuration"`.

### Task 2: Article-Only Lazy Comment Surface

**Files:**
- Create: `src/components/ArticleComments.astro`, `src/scripts/article-comments.ts`, `tests/comments/browser.test.ts`
- Modify: `src/pages/posts/[slug].astro`, `src/styles/global.css`

**Interfaces:**
- Consumes: `readGiscusConfig(import.meta.env)`, `giscusAttributes(config)` from Task 1; Giscus reads the current article `pathname` itself.
- Produces: `mountArticleComments(document: Document): void`, mounted only by `ArticleComments.astro`; one `https://giscus.app/client.js` script per click.

- [ ] **Step 1: Write failing browser-behavior tests** using the repo's Node test pattern and a small DOM stub: before click no Giscus script; first click inserts one configured script; second click inserts none; `error` restores retry plus a GitHub Discussions fallback link; absent config shows “评论未开放”.
- [ ] **Step 2: Verify RED** with `npm run verify:comments`; expect missing component/mount behavior.
- [ ] **Step 3: Implement component and mount function**; use article pathname, `crossOrigin=anonymous`, keyboard-native button, live status text, pagefind-ignore, and a link to `https://github.com/bigbrotherwei/bigbrotherwei.github.io/discussions`. Place after related posts and before `PostsSubnav`; add restrained responsive styles.
- [ ] **Step 4: Verify GREEN and build** with `npm run verify:comments && npm run build`; expect tests and Astro/Pagefind build to pass.
- [ ] **Step 5: Commit** `git add src/components/ArticleComments.astro src/scripts/article-comments.ts tests/comments/browser.test.ts src/pages/posts/'[slug].astro' src/styles/global.css && git commit -m "feat: load article comments on demand"`.

### Task 3: Privacy, Publishing, and Release Checks

**Files:**
- Create: `src/pages/privacy.astro`, `docs/comments-setup.zh.md`, `tests/comments/publishing.test.ts`
- Modify: `.github/workflows/deploy.yml`, `src/components/ArticleComments.astro`, `README.md`

**Interfaces:**
- Consumes: four public Giscus variables from Task 1 and component from Task 2.
- Produces: `/privacy/` and a Pages build that passes those variables when configured.

- [ ] **Step 1: Write failing publishing tests**: assert `/privacy/` is linked from the comment area, build output contains no `giscus.app/client.js` script before user action, and unset variables still yield a successful build with an unavailable state.
- [ ] **Step 2: Verify RED** with `npm run verify:comments`; expect missing page/workflow wiring.
- [ ] **Step 3: Implement** the public privacy page's Giscus section, owner setup steps (Discussions on, comment category, app install, IDs), GitHub Actions `vars.PUBLIC_GISCUS_*` pass-through, and README entry. Do not add access tokens or automatically install the app.
- [ ] **Step 4: Verify GREEN** with `npm run verify:comments && npm run build`, then check article desktop/mobile widths and click/error states in a browser; expect no layout overlap or eager external request.
- [ ] **Step 5: Commit** `git add src/pages/privacy.astro docs/comments-setup.zh.md tests/comments/publishing.test.ts .github/workflows/deploy.yml src/components/ArticleComments.astro README.md && git commit -m "docs: explain comment setup and privacy"`.

**Release gate:** After merging, the owner must enable Discussions, install Giscus, set the four repository variables, and trigger a new Pages build. The code alone cannot activate comments.
