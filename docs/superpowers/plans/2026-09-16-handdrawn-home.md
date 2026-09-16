# Hand-Drawn Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the second-stage home experience with a hand-drawn visual style, daily Chinese quotes, reusable layout components, and working navigation pages.

**Architecture:** Replace the single-page implementation with small Astro components and local TypeScript data modules. Keep everything static, build-time friendly, and GitHub Pages compatible.

**Tech Stack:** Astro 7, TypeScript, CSS variables, local PNG image assets, Node verification scripts.

**Spec:** `docs/superpowers/specs/2026-09-16-blog-rebuild-design.zh.md`

## Global Constraints

- Do not copy or modify `hexo-theme-fluid` source.
- Overall style must be hand-drawn / illustrated, not photorealistic.
- Site title remains `bigbrotherwei`.
- Daily quotes use local data only, no external API and no manual switch.
- Navigation must include `/`, `/posts`, `/topics`, `/tools`, `/projects`, `/about`.
- Statistics and current-online counts stay out of this phase.
- Build must pass with `npm run build`.
- GitHub Pages workflow remains compatible with remote default branch `master`.

---

### Task 1: Hand-Drawn Hero Asset And Asset Verification

**Files:**
- Create: `public/images/hero-city-sketch.png`
- Modify: `scripts/verify-assets.mjs`
- Modify: `src/pages/index.astro`
- Delete: `public/images/hero-city-night.png`

**Interfaces:**
- Produces public asset path `/images/hero-city-sketch.png`.
- Produces verification rule that fails if the homepage references the old photorealistic `hero-city-night.png`.

- [ ] **Step 1: Update asset verification first**

Change `scripts/verify-assets.mjs` so it expects:

```js
const heroPath = join(root, 'public/images/hero-city-sketch.png');
const forbiddenHeroPath = join(root, 'public/images/hero-city-night.png');
const publicReference = '/images/hero-city-sketch.png';
const forbiddenReference = '/images/hero-city-night.png';
```

Add failures when the old file exists or the old reference is present.

- [ ] **Step 2: Run asset verification and confirm it fails**

Run: `npm run verify:assets`

Expected: FAIL because `hero-city-sketch.png` does not exist yet and the homepage still references `hero-city-night.png`.

- [ ] **Step 3: Generate and save the new hero image**

Generate a hand-drawn city night illustration with no text, no logos, no watermark, no photorealism. Save it to `public/images/hero-city-sketch.png`.

- [ ] **Step 4: Update homepage to reference the new asset**

Change the home page hero image constant to:

```ts
const heroImage = '/images/hero-city-sketch.png';
```

Delete `public/images/hero-city-night.png`.

- [ ] **Step 5: Verify asset rule passes**

Run: `npm run verify:assets`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-assets.mjs src/pages/index.astro public/images/hero-city-sketch.png public/images/hero-city-night.png
git commit -m "style: replace photoreal hero with hand-drawn city"
```

### Task 2: Layout Components And Hand-Drawn Visual System

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/SiteNav.astro`
- Create: `src/components/PageHero.astro`
- Modify: `src/styles/global.css`
- Modify: `src/pages/index.astro`

**Interfaces:**
- `BaseLayout` props: `{ title: string; description?: string; heroImage?: string; bodyClass?: string }`
- `SiteNav` renders the main navigation links.
- `PageHero` props: `{ eyebrow?: string; title: string; description?: string }`

- [ ] **Step 1: Add component verification to `scripts/verify-assets.mjs`**

Add checks that these files exist:

```js
src/layouts/BaseLayout.astro
src/components/SiteNav.astro
src/components/PageHero.astro
```

- [ ] **Step 2: Run verification and confirm it fails**

Run: `npm run verify:assets`

Expected: FAIL because the component files do not exist yet.

- [ ] **Step 3: Create `SiteNav.astro`**

Render the same navigation labels and routes as the current homepage.

- [ ] **Step 4: Create `BaseLayout.astro`**

Centralize `<html>`, metadata, favicon, preload image, navigation, and page slot.

- [ ] **Step 5: Create `PageHero.astro`**

Use for simple top sections on inner pages.

- [ ] **Step 6: Update `global.css`**

Use hand-drawn design tokens: ink, paper, muted teal, coral, amber, sketch borders, card shadows, readable Chinese typography, and responsive constraints.

- [ ] **Step 7: Refactor `index.astro`**

Use `BaseLayout` and the new hand-drawn homepage classes instead of owning the entire HTML document.

- [ ] **Step 8: Verify**

Run: `npm run verify:assets`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/layouts src/components src/pages/index.astro src/styles/global.css scripts/verify-assets.mjs
git commit -m "refactor: add hand-drawn layout system"
```

### Task 3: Daily Chinese Quote Module

**Files:**
- Create: `src/data/quotes.ts`
- Create: `scripts/verify-quotes.mjs`
- Modify: `package.json`
- Modify: `src/pages/index.astro`

**Interfaces:**
- `type Quote = { text: string; author: string; source?: string; tags: string[] }`
- `quotes: Quote[]`
- `getDailyQuote(date?: Date): Quote`

- [ ] **Step 1: Add quote verification script**

Create `scripts/verify-quotes.mjs` that imports the built source using dynamic TypeScript-compatible checks by reading `src/data/quotes.ts` as text. It must verify:

- at least 100 quote objects are present;
- `getDailyQuote` is exported;
- each quote has `text`, `author`, and `tags`;
- no quote text contains `TODO` or `TBD`.

- [ ] **Step 2: Wire quote verification into package scripts**

Add:

```json
"verify:quotes": "node scripts/verify-quotes.mjs",
"verify": "npm run verify:assets && npm run verify:quotes"
```

Change `build` to start with `npm run verify`.

- [ ] **Step 3: Run quote verification and confirm it fails**

Run: `npm run verify:quotes`

Expected: FAIL because `src/data/quotes.ts` does not exist.

- [ ] **Step 4: Create quotes module**

Add at least 100 Chinese-first quotes and implement `getDailyQuote(date = new Date())` deterministically by day number modulo `quotes.length`.

- [ ] **Step 5: Use daily quote on homepage**

Import `getDailyQuote` into `src/pages/index.astro` and render the quote text plus author/source.

- [ ] **Step 6: Verify**

Run: `npm run verify:quotes`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data/quotes.ts scripts/verify-quotes.mjs package.json src/pages/index.astro
git commit -m "feat: add daily Chinese quote module"
```

### Task 4: Home Sections And Navigation Pages

**Files:**
- Create: `src/pages/posts/index.astro`
- Create: `src/pages/topics/index.astro`
- Create: `src/pages/tools/index.astro`
- Create: `src/pages/projects/index.astro`
- Create: `src/pages/about.astro`
- Modify: `src/pages/index.astro`
- Modify: `README.md`

**Interfaces:**
- Every main navigation URL must resolve to a static page.
- Homepage must include cards for articles, topics, tools, projects, and about.

- [ ] **Step 1: Add route verification to `scripts/verify-assets.mjs`**

Verify these files exist:

```text
src/pages/posts/index.astro
src/pages/topics/index.astro
src/pages/tools/index.astro
src/pages/projects/index.astro
src/pages/about.astro
```

- [ ] **Step 2: Run verification and confirm it fails**

Run: `npm run verify:assets`

Expected: FAIL because the route pages do not exist yet.

- [ ] **Step 3: Add homepage sections**

Add hand-drawn cards for latest articles, the blog rebuild topic, utility tools, projects, and about.

- [ ] **Step 4: Add `/posts` page**

Create a placeholder article list page with a clear empty state and next-step copy.

- [ ] **Step 5: Add `/topics` page**

Create a topics page featuring `个人博客重构` as the first topic.

- [ ] **Step 6: Add `/tools` page**

Create a tools landing page with search/category UI shell and first planned tool cards, but no tool logic yet.

- [ ] **Step 7: Add `/projects` page**

Create a project page listing the blog rebuild as an active project.

- [ ] **Step 8: Add `/about` page**

Create a concise Chinese about page with interests and current focus.

- [ ] **Step 9: Update README**

Document second-stage scope and the hand-drawn visual direction.

- [ ] **Step 10: Verify full build**

Run: `npm run build`

Expected: PASS with 6 static pages or more.

- [ ] **Step 11: Commit**

```bash
git add src/pages README.md scripts/verify-assets.mjs
git commit -m "feat: add hand-drawn home sections and nav pages"
```

## Self-Review

Spec coverage:

- Hand-drawn style implements the user's updated visual direction.
- Daily quote module covers the design doc's no-external-API daily quote requirement.
- Main navigation pages exist for all primary nav links.
- Tool logic, content collections, search, comments, and statistics are intentionally deferred.

Placeholder scan:

- This plan contains no unresolved TODO or TBD placeholders.

Type consistency:

- `BaseLayout`, `SiteNav`, `PageHero`, `quotes`, and `getDailyQuote` are defined before use by later tasks.
