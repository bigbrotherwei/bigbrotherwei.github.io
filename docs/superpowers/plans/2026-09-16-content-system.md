# Content System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fourth-stage article and topic content system so the blog can publish Markdown posts and organize them into topic paths.

**Architecture:** Use Astro Content Collections as the source of truth. Posts live in `src/content/posts/*.md`, topics live in `src/content/topics/*.md`, and page routes read collections at build time to generate static list and detail pages.

**Tech Stack:** Astro 7, TypeScript, Astro Content Collections, Markdown, Node verification scripts, CSS variables.

**Spec:** `docs/superpowers/specs/2026-09-16-blog-rebuild-design.zh.md`

## Global Constraints

- Keep the existing hand-drawn / night illustration visual style.
- Do not add runtime backend, database, or external CMS in this phase.
- Articles are time-ordered standalone posts.
- Topics are curated paths that group existing posts by slug.
- Publishing order is: create or update a topic, create posts, assign post frontmatter `topic` to the topic slug, run `npm run build`, open a PR.
- Build must pass with `npm run build`.
- GitHub Pages workflow remains static and compatible with remote default branch `master`.

---

### Task 1: Content Verification Contract

**Files:**
- Create: `scripts/verify-content.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `npm run verify:content`.
- `npm run verify` must include `verify:content`.

- [x] **Step 1: Write content verification script**

Create `scripts/verify-content.mjs` that checks:

```js
src/content.config.ts exists
src/content/posts exists
src/content/topics exists
src/pages/posts/[slug].astro exists
src/pages/topics/[slug].astro exists
at least 3 post markdown files exist
at least 2 topic markdown files exist
each post frontmatter has title, description, pubDate, tags, topic, order
each topic frontmatter has title, description, status, order
each post topic points to an existing topic slug
README documents article vs topic and publishing order
```

- [x] **Step 2: Wire verification into package scripts**

Add:

```json
"verify:content": "node scripts/verify-content.mjs"
```

Update `verify` so it runs after `verify:night-background`.

- [x] **Step 3: Run verification and confirm red**

Run: `npm run verify:content`

Expected: FAIL because content collections, Markdown content, and dynamic routes do not exist yet.

### Task 2: Content Collections And Sample Markdown

**Files:**
- Create: `src/content.config.ts`
- Create: `src/content/posts/*.md`
- Create: `src/content/topics/*.md`

**Interfaces:**
- `posts` collection fields: `title`, `description`, `pubDate`, `updatedDate`, `tags`, `topic`, `order`, `draft`.
- `topics` collection fields: `title`, `description`, `status`, `order`.

- [x] **Step 1: Create Astro content config**

Use:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
```

Define `posts` and `topics` with `glob` loaders.

- [x] **Step 2: Add two topic files**

Create:

```text
src/content/topics/blog-rebuild.md
src/content/topics/developer-toolbox.md
```

- [x] **Step 3: Add three post files**

Create:

```text
src/content/posts/blog-rebuild-roadmap.md
src/content/posts/github-pages-workflow.md
src/content/posts/night-sketch-background.md
```

Each post must point to an existing topic.

- [x] **Step 4: Verify content contract passes**

Run: `npm run verify:content`

Expected: PASS.

### Task 3: List And Detail Pages

**Files:**
- Modify: `src/pages/posts/index.astro`
- Create: `src/pages/posts/[slug].astro`
- Modify: `src/pages/topics/index.astro`
- Create: `src/pages/topics/[slug].astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- `/posts/` lists non-draft posts sorted by `pubDate` descending.
- `/posts/[slug]/` renders a post with metadata, tags, and topic link.
- `/topics/` lists topics sorted by `order`.
- `/topics/[slug]/` renders topic body plus posts belonging to that topic sorted by `order` then date.

- [x] **Step 1: Replace posts placeholder page**

Use `getCollection('posts')`, filter `draft !== true`, sort by date descending, and render post cards.

- [x] **Step 2: Add post detail route**

Use `getStaticPaths()`, `render(entry)`, and `BaseLayout`.

- [x] **Step 3: Replace topics placeholder page**

Use `getCollection('topics')` and show linked topic cards with counts.

- [x] **Step 4: Add topic detail route**

Render topic content and list matching posts.

- [x] **Step 5: Add content styles**

Add list metadata, tags, article body, and linked-card styles without breaking existing pages.

- [x] **Step 6: Build**

Run: `npm run build`

Expected: PASS and static routes include post/topic detail pages.

### Task 4: Maintenance Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-09-16-content-system.md`

**Interfaces:**
- README must explain:
  - article vs topic difference;
  - publishing order;
  - how to create a new topic;
  - how to create a new article;
  - how to link article to topic.

- [x] **Step 1: Add content maintenance guide**

Add a Chinese section to README with exact frontmatter examples for topic and article creation.

- [x] **Step 2: Mark plan tasks completed as implemented**

Update this plan file checkboxes after verification.

- [x] **Step 3: Final verification**

Run:

```bash
npm run build
npm audit --audit-level=low
```

Expected: both pass.
