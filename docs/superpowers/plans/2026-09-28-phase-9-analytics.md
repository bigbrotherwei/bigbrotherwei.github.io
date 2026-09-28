# Phase 9 Visits And Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add site PV, estimated cumulative UV, live browser presence, and article read counts to the static blog.

**Architecture:** A separate Cloudflare Worker validates three API routes and stores aggregate counters, hashed visitor keys, and short-lived presence in D1. A browser controller records navigation and visible-tab heartbeats; homepage and article pages read only the numbers they display. Missing configuration or service failure degrades to an explicit unavailable state without affecting static content.

**Tech Stack:** Astro 7, TypeScript 6, Cloudflare Workers/D1/Wrangler, Cloudflare Vitest pool, Node 22, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-28-phase-9-comments-analytics-design.zh.md`

**Prerequisite:** Complete the comments plan first; its privacy page and Pages variable wiring are extended here. Worker/API tasks can be developed and tested without Cloudflare account access.

## Global Constraints

- PV counts accepted navigations; duplicate `{visitorId,path}` visits within 5 seconds count once.
- UV is a lifetime estimate of distinct browsers; HMAC-SHA-256 visitor hashes are stored long-term, never raw IDs or plaintext IPs.
- Presence means distinct visitor hashes with a heartbeat in the last 90 seconds; visible tabs send every 30 seconds.
- Other routes contribute to site totals but show no local counts; only article details show read counts.
- D1 and Worker deployment are separate from the existing GitHub Pages workflow and require owner Cloudflare setup.
- API failures and missing public URL display unavailable, never zero; no secret appears in public source, build artifacts, or logs.

## Review Focus

- A forged Origin or malformed JSON must not change counters; Task 2 tests rejection.
- A refresh after 5 seconds must increment PV but not UV; Task 2 tests both boundaries.
- Two tabs with one local identifier must count online once; Tasks 2 and 3 test deduplication.
- A hidden tab must stop heartbeat and expire from online after 90 seconds; Tasks 2 and 3 test time behavior.
- A failed POST or GET must keep the blog usable and display “暂不可用”; Tasks 3 and 4 test UI degradation.

---

### Task 1: D1 Schema and Worker Test Harness

**Files:**
- Create: `worker/wrangler.jsonc`, `worker/migrations/0001_statistics.sql`, `worker/vitest.config.ts`, `worker/tsconfig.json`, `worker/tests/schema.test.ts`
- Modify: `package.json`, `package-lock.json`, `.gitignore`

**Interfaces:**
- Produces D1 binding `DB` with `site_totals(id,pv,uv)`, `article_views(path,pv)`, `visitors(visitor_hash)`, `recent_visits(visitor_hash,path,last_at)`, and `presence(visitor_hash,last_seen)`.
- Database triggers increment PV/UV only on accepted recent-visit and new-visitor inserts; a recent-visit update increments PV only when `last_at <= now-5`.

- [ ] **Step 1: Write failing schema tests** using the Cloudflare Vitest pool/local D1: initialize the migration; assert first visit creates PV=1/UV=1, same hash/path at +4s leaves PV=1, and at +5s yields PV=2/UV=1.
- [ ] **Step 2: Verify RED** with `npm run verify:worker`; expect missing schema/config.
- [ ] **Step 3: Add local Wrangler/Vitest config and SQL migration**; add `wrangler`, `vitest`, `@cloudflare/vitest-pool-workers` as dev dependencies, a `verify:worker` script, and ignore `.dev.vars`/`.wrangler`. Use a placeholder D1 UUID in checked-in config and document replacing it for production.
- [ ] **Step 4: Verify GREEN** with `npm run verify:worker`; expect migration and trigger tests to pass.
- [ ] **Step 5: Commit** `git add worker package.json package-lock.json .gitignore && git commit -m "feat: add D1 statistics schema"`.

### Task 2: Worker API and Cleanup

**Files:**
- Create: `worker/src/index.ts`, `worker/src/validation.ts`, `worker/src/identity.ts`, `worker/tests/api.test.ts`
- Modify: `worker/wrangler.jsonc`

**Interfaces:**
- Consumes: `DB`, secret `VISITOR_HMAC_KEY`, public `ALLOWED_ORIGINS` from Worker environment.
- Produces: `POST /visit` (`{path,visitorId}`), `POST /heartbeat` (`{visitorId}`), `GET /stats?path=...` (`{pv,uv,online}` for `/`, `{reads}` for article paths), and scheduled cleanup of presence/recent visits older than 24 hours.

- [ ] **Step 1: Write failing API tests**: allowed production Origin succeeds; unrelated Origin, non-JSON, oversized body, malformed UUID, full URL/query/unknown route shape fail without counter changes; duplicate visit at +4s and repeat at +5s follow spec; two tabs sharing one ID produce online=1; heartbeat at +90s falls outside the active window; database failure yields 503 without partial count changes.
- [ ] **Step 2: Verify RED** with `npm run verify:worker`; expect missing routes/validation.
- [ ] **Step 3: Implement** `normalizeSitePath(path: string): string | null`, `hashVisitorId(secret: string, visitorId: string): Promise<string>`, and default Worker's `fetch`/`scheduled`. Use `crypto.subtle`, bound SQL, `DB.batch()` for a visit, `Cache-Control: no-store`, noncredential CORS and no sensitive logs. Accept only canonical static routes plus slug-shaped article/topic/project/tag/tool routes; format validation does not prove a page exists.
- [ ] **Step 4: Verify GREEN** with `npm run verify:worker`; expect all API and scheduled-cleanup tests to pass.
- [ ] **Step 5: Commit** `git add worker/src worker/tests worker/wrangler.jsonc && git commit -m "feat: expose privacy-aware visit API"`.

### Task 3: Browser Visit and Heartbeat Controller

**Files:**
- Create: `src/lib/analytics.ts`, `src/scripts/analytics.ts`, `tests/analytics/controller.test.ts`
- Modify: `src/layouts/BaseLayout.astro`, `src/env.d.ts`, `package.json`

**Interfaces:**
- Consumes: `PUBLIC_ANALYTICS_API_URL`, `POST /visit`, `POST /heartbeat`, `GET /stats` from Task 2.
- Produces: `mountAnalytics(document: Document, window: Window, apiUrl: string): void` and `readVisitorId(storage: Storage, randomUUID: () => string): string | null`.

- [ ] **Step 1: Write failing controller tests**: one navigation sends one visit; visible state sends immediate and 30-second heartbeats; hidden state stops them; another tab reuses stored UUID; unavailable localStorage disables telemetry; missing API URL makes no request; network failure never throws into page code.
- [ ] **Step 2: Verify RED** with `npm run verify:analytics`; expect missing module/script.
- [ ] **Step 3: Implement** helpers and layout mount using the repo's client-script pattern. Use `document.visibilityState`, visibility listeners, `AbortController` where helpful, and do not put visitor ID in query strings or Giscus config. Add `verify:analytics` to `verify`.
- [ ] **Step 4: Verify GREEN** with `npm run verify:analytics && npm run build`; expect all tests and static build to pass.
- [ ] **Step 5: Commit** `git add src/lib/analytics.ts src/scripts/analytics.ts tests/analytics/controller.test.ts src/layouts/BaseLayout.astro src/env.d.ts package.json && git commit -m "feat: record browser visits and presence"`.

### Task 4: Statistics Display and Privacy Copy

**Files:**
- Create: `src/components/SiteStats.astro`, `src/components/ArticleReads.astro`, `tests/analytics/display.test.ts`
- Modify: `src/pages/index.astro`, `src/pages/posts/[slug].astro`, `src/pages/privacy.astro`, `src/styles/global.css`

**Interfaces:**
- Consumes: `GET /stats` and public URL from Tasks 2-3.
- Produces: homepage PV/UV/online band, article header read-count label, loading/unavailable/ready states, privacy link.

- [ ] **Step 1: Write failing display tests**: home labels map `pv`,`uv`,`online` correctly, article label uses `reads` only, zero is displayed only after a successful response, HTTP failure renders “暂不可用”, and both visible surfaces link `/privacy/`.
- [ ] **Step 2: Verify RED** with `npm run verify:analytics`; expect missing surfaces.
- [ ] **Step 3: Implement** accessible, responsive components with distinct restrained styling for counts versus tags/TOC/reading progress; exclude from Pagefind. Expand `/privacy/` with HMAC, lifetime UV retention, 90-second online estimate, localStorage clearing effects, and third-party comments.
- [ ] **Step 4: Verify GREEN** with `npm run verify:analytics && npm run build`; inspect desktop/mobile home and article pages, failure states, and no overlap.
- [ ] **Step 5: Commit** `git add src/components/SiteStats.astro src/components/ArticleReads.astro tests/analytics/display.test.ts src/pages/index.astro src/pages/posts/'[slug].astro' src/pages/privacy.astro src/styles/global.css && git commit -m "feat: show site and article statistics"`.

### Task 5: Deployment Guide and End-to-End Verification

**Files:**
- Create: `docs/analytics-setup.zh.md`, `tests/analytics/publishing.test.ts`
- Modify: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: `PUBLIC_ANALYTICS_API_URL`, Worker `DB`, `VISITOR_HMAC_KEY`, `ALLOWED_ORIGINS`.
- Produces: repeatable manual Worker/D1 deployment and independent Pages activation/rollback.

- [ ] **Step 1: Write failing publishing tests**: Pages workflow passes public URL from repository vars, unset URL builds without requests, no HMAC key appears in generated `dist`, and worker setup documents create/migrate/secret/deploy/test/rollback sequence.
- [ ] **Step 2: Verify RED** with `npm run verify:analytics`; expect missing workflow/docs contract.
- [ ] **Step 3: Implement** Chinese setup guide, README link and Pages build-variable pass-through. Document database-ID replacement, migration, secret configuration, cron, allowed Origin, manual Worker deployment, abuse/quotas, two-browser verification, and rollback. Do not add Cloudflare credentials to GitHub Actions.
- [ ] **Step 4: Verify GREEN** with `npm run verify:worker && npm run verify:analytics && npm run build`; inspect generated output for public URL and absence of secrets; run browser checks across desktop/mobile; expect normal static content when API is offline.
- [ ] **Step 5: Commit** `git add docs/analytics-setup.zh.md tests/analytics/publishing.test.ts .github/workflows/deploy.yml README.md && git commit -m "docs: describe analytics deployment and verification"`.

**Release gate:** The owner must create Cloudflare D1/Worker resources, set the Worker secret, run migrations, deploy the Worker, set the public GitHub Pages variable, and trigger a new Pages build. Code merging alone does not turn on production statistics.
