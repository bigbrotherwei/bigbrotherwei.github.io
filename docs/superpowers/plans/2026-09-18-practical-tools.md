# Practical Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build six production-ready browser-only utilities, a searchable tool directory, and unique responsive artwork for every tool page.

**Architecture:** Tool transformations live in small DOM-free TypeScript modules and return typed success/error results. Astro pages own presentation and browser events through bundled scripts, while a shared tool layout and stylesheet keep the six workspaces consistent. Tool metadata is the single source for the directory, routes, categories, and background keys.

**Tech Stack:** Astro 7, TypeScript 6, browser Web APIs, Node 25 built-in test runner, generated lossy WebP assets.

**Spec:** `docs/superpowers/specs/2026-09-18-practical-tools-design.zh.md`

## Global Constraints

- Implement exactly JSON, Base64, URL component, timestamp, UUID v4, and text-counter tools in this phase.
- All user content stays in the browser: no network requests, persistence, analytics payloads, or server processing.
- Do not add React, Vue, a test framework, or a heavy utility dependency.
- Each tool detail page requires a unique desktop WebP of at least 1600x900 and mobile WebP of at least 720x1280.
- Keep controls keyboard accessible, expose status through `aria-live`, and never render user input through `innerHTML`.
- Every implementation task follows red-green-refactor and ends with a focused commit.

---

### Task 1: Test Harness and JSON Logic

**Files:**
- Create: `src/lib/tools/result.ts`
- Create: `src/lib/tools/json.ts`
- Create: `tests/tools/json.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `ToolResult<T> = { ok: true; value: T } | { ok: false; error: string }`.
- Produces: `formatJson(input: string): ToolResult<string>`, `minifyJson(input: string): ToolResult<string>`, and `validateJson(input: string): ToolResult<true>`.

- [ ] **Step 1: Add the failing JSON tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { formatJson, minifyJson, validateJson } from '../../src/lib/tools/json.ts';

test('formats valid JSON with two spaces', () => {
  assert.deepEqual(formatJson('{"name":"博客","items":[1,2]}'), {
    ok: true,
    value: '{\n  "name": "博客",\n  "items": [\n    1,\n    2\n  ]\n}',
  });
});

test('minifies valid JSON', () => {
  assert.deepEqual(minifyJson('{ "ok": true }'), { ok: true, value: '{"ok":true}' });
});

test('rejects comments and trailing commas without replacing input', () => {
  const result = validateJson('{"ok": true,}');
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /JSON/);
});
```

- [ ] **Step 2: Add the test script and verify red**

Set `"verify:tools": "node --test tests/tools/*.test.ts"` and add `npm run verify:tools` to `verify`.

Run: `npm run verify:tools`
Expected: FAIL because `src/lib/tools/json.ts` does not exist.

- [ ] **Step 3: Implement the minimal typed result and JSON functions**

```ts
export type ToolResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const parseJson = (input: string): ToolResult<unknown> => {
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法解析 JSON';
    return { ok: false, error: `JSON 无效：${message}` };
  }
};
```

Have format/minify call the shared parser and `JSON.stringify` with `2` or no spacing. Validation returns `{ ok: true, value: true }` after parsing.

- [ ] **Step 4: Run focused and full verification**

Run: `npm run verify:tools && npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json src/lib/tools/result.ts src/lib/tools/json.ts tests/tools/json.test.ts
git commit -m "feat: add tested JSON transformations"
```

### Task 2: Base64 and URL Logic

**Files:**
- Create: `src/lib/tools/base64.ts`
- Create: `src/lib/tools/url.ts`
- Create: `tests/tools/base64.test.ts`
- Create: `tests/tools/url.test.ts`

**Interfaces:**
- Consumes: `ToolResult<T>` from `src/lib/tools/result.ts`.
- Produces: `encodeBase64(input: string): ToolResult<string>` and `decodeBase64(input: string): ToolResult<string>`.
- Produces: `encodeUrlComponent(input: string): ToolResult<string>` and `decodeUrlComponent(input: string): ToolResult<string>`.

- [ ] **Step 1: Write failing UTF-8 and malformed-input tests**

```ts
test('round-trips Chinese and emoji', () => {
  const encoded = encodeBase64('博客🌙');
  assert.equal(encoded.ok, true);
  if (encoded.ok) assert.deepEqual(decodeBase64(encoded.value), { ok: true, value: '博客🌙' });
});

test('rejects malformed Base64', () => {
  const result = decodeBase64('%%%');
  assert.equal(result.ok, false);
});

test('encodes a URL component without hiding errors', () => {
  assert.deepEqual(encodeUrlComponent('搜索?q=中文'), {
    ok: true,
    value: '%E6%90%9C%E7%B4%A2%3Fq%3D%E4%B8%AD%E6%96%87',
  });
  assert.equal(decodeUrlComponent('%E0%A4%A').ok, false);
});
```

- [ ] **Step 2: Run tests to verify red**

Run: `npm run verify:tools`
Expected: FAIL on missing Base64 and URL modules.

- [ ] **Step 3: Implement UTF-8-safe transformations**

Use `TextEncoder`/`TextDecoder` with fatal decoding. Convert bytes to/from binary strings only at the `btoa`/`atob` boundary. Validate Base64 alphabet, padding, and round-trip canonical form before decoding. Wrap URI operations with the same typed error result.

- [ ] **Step 4: Run focused and full tests**

Run: `npm run verify:tools && npm run build`
Expected: PASS with 11 existing pages.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tools/base64.ts src/lib/tools/url.ts tests/tools/base64.test.ts tests/tools/url.test.ts
git commit -m "feat: add encoding tool logic"
```

### Task 3: Timestamp, UUID, and Text Statistics Logic

**Files:**
- Create: `src/lib/tools/timestamp.ts`
- Create: `src/lib/tools/uuid.ts`
- Create: `src/lib/tools/text-counter.ts`
- Create: `tests/tools/timestamp.test.ts`
- Create: `tests/tools/uuid.test.ts`
- Create: `tests/tools/text-counter.test.ts`

**Interfaces:**
- Produces: `convertTimestamp(input: string, unit: 'auto' | 'seconds' | 'milliseconds'): ToolResult<TimestampResult>`.
- Produces: `generateUuids(count: number, randomUuid?: () => string): ToolResult<string[]>`.
- Produces: `countText(input: string): TextStatistics`.

```ts
export interface TimestampResult {
  milliseconds: number;
  seconds: number;
  local: string;
  iso: string;
}

export interface TextStatistics {
  characters: number;
  charactersWithoutWhitespace: number;
  chineseCharacters: number;
  englishWords: number;
  lines: number;
  utf8Bytes: number;
}
```

- [ ] **Step 1: Write failing boundary tests**

Cover 10-digit seconds, 13-digit milliseconds, explicit unit override, non-numeric and out-of-range timestamps; UUID counts `0`, `1`, `20`, `21`, deterministic injected UUIDs, and missing generator; empty text, trailing newline, Chinese, alphanumeric words, emoji, and UTF-8 bytes.

- [ ] **Step 2: Run tests to verify red**

Run: `npm run verify:tools`
Expected: FAIL on missing modules.

- [ ] **Step 3: Implement minimal pure functions**

Auto-detect seconds when the absolute numeric value is below `100_000_000_000`; otherwise treat as milliseconds. Reject non-finite values and invalid `Date` results. Keep `crypto.randomUUID` outside the pure core by accepting an injected callback, defaulting to `globalThis.crypto?.randomUUID?.bind(globalThis.crypto)`. Count Unicode characters with `Array.from`, Chinese characters with a Unicode Han regex, English words with Unicode letter/number runs excluding Han, visible lines after removing one terminal newline, and bytes with `TextEncoder`.

- [ ] **Step 4: Run all tool tests and build**

Run: `npm run verify:tools && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tools/timestamp.ts src/lib/tools/uuid.ts src/lib/tools/text-counter.ts tests/tools
git commit -m "feat: add time identifier and text utilities"
```

### Task 4: Tool Registry and Searchable Directory

**Files:**
- Create: `src/data/tools.ts`
- Create: `scripts/verify-tools.mjs`
- Create: `tests/tools/registry.test.ts`
- Create: `src/pages/tools/json.astro`
- Create: `src/pages/tools/base64.astro`
- Create: `src/pages/tools/url.astro`
- Create: `src/pages/tools/timestamp.astro`
- Create: `src/pages/tools/uuid.astro`
- Create: `src/pages/tools/text-counter.astro`
- Modify: `src/pages/tools/index.astro`
- Modify: `package.json`

**Interfaces:**
- Produces: `ToolDefinition`, `toolCategories`, and `tools` metadata.
- Produces DOM contract: cards use `data-tool-card`, searchable text in `data-search`, filters use `data-category-filter`, and empty state uses `data-empty-state`.

- [ ] **Step 1: Write failing registry and route verification**

Test that the six slugs are unique, category values are valid, links end in `/tools/<slug>/`, and background keys are unique. The verification script must require all six Astro route files and ensure the directory imports `tools` rather than declaring a local title array.

- [ ] **Step 2: Run the test to verify red**

Run: `npm run verify:tools`
Expected: FAIL because registry and routes do not exist.

- [ ] **Step 3: Add registry and interactive directory**

Replace disabled search with a real `<input type="search">`, render category buttons as a segmented filter with `aria-pressed`, and render linked cards from `tools`. Add a bundled script that normalizes search text with `.toLocaleLowerCase('zh-CN')`, combines query and category, toggles `hidden`, and announces result count.

- [ ] **Step 4: Add static verification to the build**

Change the package script to `"verify:tools": "node --test tests/tools/*.test.ts && node scripts/verify-tools.mjs"`. Require exact routes, registry import, search hooks, and unique background keys without duplicating business-logic unit tests.

- [ ] **Step 5: Run verification and commit**

Run: `npm run verify:tools && npm run build`
Expected: registry tests PASS; route verification remains red only until Task 6 creates pages, so create six minimal route files that render the shared layout placeholder and are replaced in Task 6.

```bash
git add package.json scripts/verify-tools.mjs tests/tools/registry.test.ts src/data/tools.ts src/pages/tools
git commit -m "feat: add searchable tool directory"
```

### Task 5: Shared Tool Workspace

**Files:**
- Create: `src/components/tools/ToolLayout.astro`
- Create: `src/lib/tools/browser.ts`
- Create: `src/styles/tools.css`
- Modify: `src/styles/global.css`
- Create: `tests/tools/browser.test.ts`

**Interfaces:**
- `ToolLayout` accepts `title`, `description`, `backgroundKey`, and an optional `statusId`, then renders the page hero, privacy note, workspace slot, and live status.
- Browser helpers produce `copyText(value: string, clipboard?: Pick<Clipboard, 'writeText'>): Promise<ToolResult<true>>` and `debounce<T>(callback, delay)`.
- CSS classes: `.tool-page`, `.tool-workspace`, `.tool-fields`, `.tool-field`, `.tool-toolbar`, `.tool-status`, `.tool-results`.

- [ ] **Step 1: Write failing browser-helper tests**

Test copy success, rejected clipboard promises, and debounce replacing an earlier call.

- [ ] **Step 2: Run tests to verify red**

Run: `npm run verify:tools`
Expected: FAIL because browser helpers do not exist.

- [ ] **Step 3: Implement helpers, layout, and responsive workspace styling**

The layout imports `BaseLayout`, passes the selected background, provides a “返回工具箱” link, and includes the privacy copy. Use unframed page structure with one genuine workspace panel; do not nest decorative cards. Define stable textarea minimum heights, two equal desktop columns, one mobile column, visible focus states, error/success colors with sufficient contrast, and icon-button dimensions that cannot shift.

- [ ] **Step 4: Run tests and Astro check**

Run: `npm run verify:tools && npm run astro -- check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/tools src/lib/tools/browser.ts src/styles/tools.css src/styles/global.css tests/tools/browser.test.ts
git commit -m "feat: add shared tool workspace"
```

### Task 6: Six Interactive Tool Pages

**Files:**
- Replace: `src/pages/tools/json.astro`
- Replace: `src/pages/tools/base64.astro`
- Replace: `src/pages/tools/url.astro`
- Replace: `src/pages/tools/timestamp.astro`
- Replace: `src/pages/tools/uuid.astro`
- Replace: `src/pages/tools/text-counter.astro`

**Interfaces:**
- Consumes all pure functions from Tasks 1-3 and `copyText`/`debounce` from Task 5.
- Every page uses `ToolLayout` and its registry `backgroundKey`.

- [ ] **Step 1: Extend static verification with page contracts and verify red**

Require each page to import its corresponding logic module, render a labeled input, render an `aria-live` status through the shared layout, and avoid `innerHTML`, `fetch(`, `localStorage`, and `sessionStorage`.

Run: `npm run verify:tools`
Expected: FAIL against placeholder pages.

- [ ] **Step 2: Implement JSON, Base64, and URL pages**

JSON provides format, minify, validate, copy, and clear commands. Base64 and URL use two-option segmented mode controls, input/output fields, swap, copy, and clear. All results use `.value` or `.textContent`; invalid input writes the typed error to the live status and leaves the source untouched.

- [ ] **Step 3: Implement timestamp, UUID, and text-counter pages**

Timestamp provides auto/seconds/milliseconds unit selection plus “现在”. UUID uses a numeric input clamped to 1-20, generate, copy item, and copy all. Text counter debounces input and updates six stable result cells.

- [ ] **Step 4: Run logic, static, and build verification**

Run: `npm run verify:tools && npm run build`
Expected: PASS and 17 static routes build.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-tools.mjs src/pages/tools
git commit -m "feat: build six interactive browser tools"
```

### Task 7: Unique Tool Backgrounds

**Files:**
- Create: `public/images/backgrounds/tool-json-archive.webp`
- Create: `public/images/backgrounds/tool-json-archive-mobile.webp`
- Create: `public/images/backgrounds/tool-base64-telegraph.webp`
- Create: `public/images/backgrounds/tool-base64-telegraph-mobile.webp`
- Create: `public/images/backgrounds/tool-url-waystation.webp`
- Create: `public/images/backgrounds/tool-url-waystation-mobile.webp`
- Create: `public/images/backgrounds/tool-timestamp-clockshop.webp`
- Create: `public/images/backgrounds/tool-timestamp-clockshop-mobile.webp`
- Create: `public/images/backgrounds/tool-uuid-greenhouse.webp`
- Create: `public/images/backgrounds/tool-uuid-greenhouse-mobile.webp`
- Create: `public/images/backgrounds/tool-text-scriptorium.webp`
- Create: `public/images/backgrounds/tool-text-scriptorium-mobile.webp`
- Modify: `src/data/backgrounds.ts`
- Modify: `scripts/verify-visual-background.mjs`

**Interfaces:**
- Produces background keys: `tool-json`, `tool-base64`, `tool-url`, `tool-timestamp`, `tool-uuid`, and `tool-text-counter`.

- [ ] **Step 1: Add expected tool backgrounds to visual verification and verify red**

Require six unique desktop/mobile entries, dimensions, lossy WebP encoding, size range, registry uniqueness, and usage by the six pages.

Run: `npm run verify:visual-background`
Expected: FAIL because assets and keys are missing.

- [ ] **Step 2: Generate six original desktop scenes**

Use the existing farm artwork only as art-direction reference. Generate archive room, telegraph hut, valley waystation, clock workshop, seed-numbering greenhouse, and scriptorium scenes with blue-hour lighting, warm practical lamps, detailed hand painting, subtle game texture, no text, logos, people, animals, or copied game assets.

- [ ] **Step 3: Produce mobile crops and register all assets**

Convert desktop sources to lossy WebP at least 1600x900. Create deliberate 720x1280 crops that preserve the scene subject behind the compact mobile workspace. Add registry entries and use them in tool metadata/pages.

- [ ] **Step 4: Run visual and full verification**

Run: `npm run verify:visual-background && npm run build`
Expected: PASS with all 12 new assets validated.

- [ ] **Step 5: Commit**

```bash
git add public/images/backgrounds src/data/backgrounds.ts scripts/verify-visual-background.mjs src/data/tools.ts src/pages/tools
git commit -m "feat: add unique hand-painted tool backgrounds"
```

### Task 8: Documentation, Browser QA, and Pull Request

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-16-blog-rebuild-design.zh.md`
- Modify: `src/content/topics/developer-toolbox.md`

**Interfaces:**
- Documents exact routes, privacy behavior, testing command, and future tool authoring steps.

- [ ] **Step 1: Update maintenance documentation**

Document the six live tools, how to add registry metadata/logic/page/tests/backgrounds, and the requirement that tool input never leaves the browser. Update the developer-toolbox topic from “计划中” to “更新中” and describe the first shipped batch without claiming future tools exist.

- [ ] **Step 2: Run final automated verification**

Run: `git diff --check && npm run build`
Expected: no whitespace errors; all verification, Astro check, and 17-page static build pass.

- [ ] **Step 3: Perform browser QA at desktop and mobile widths**

Test `/tools/` search plus category combinations, then every tool with one success and one error case. Check copy feedback, keyboard focus, long input, empty input, unique background loading, mobile crop, no overlap, and browser console errors at 1440x900 and 390x844.

- [ ] **Step 4: Request code review and fix confirmed findings**

Review business logic, unsafe DOM operations, route/background uniqueness, accessibility, responsive layout, and missing tests. Re-run `npm run build` after fixes.

- [ ] **Step 5: Commit, push, and create a PR targeting master**

```bash
git add README.md docs src
git commit -m "docs: document practical tool workflows"
git push -u origin codex/phase-5-tools-20260918
```

Create a non-draft PR with base `master`. Report the PR URL, local verification results, browser QA coverage, and remote workflow state without claiming deployment before merge.
