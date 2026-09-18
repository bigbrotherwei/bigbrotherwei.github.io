# Task 4 Report: Tool Registry and Searchable Directory

## Status

Implemented the tool registry, searchable directory, static route verification, and six minimal tool routes.

## TDD Evidence

### Red

1. `npm run verify:tools` exited 1 before the registry existed.
   - Cause: `ERR_MODULE_NOT_FOUND` for `src/data/tools.ts` imported by `tests/tools/registry.test.ts`.
   - Existing tool tests: 24 passed; registry test file failed as expected.
2. After the first green cycle, the static verifier was extended to require a result-count live region.
   - `npm run verify:tools` exited 1 with `Tool directory must include: data-result-count`.
   - Unit tests: 26 passed; the required directory contract failed as expected.

### Green

1. `npm run verify:tools` exited 0 after the registry, routes, directory controls, and live region were added.
   - Result: 26 tests passed, 0 failed.
   - The static verifier also passed for exact routes, registry import, search hooks, result announcements, and unique background keys.
2. `npm run build` exited 0.
   - Result: all verification scripts passed; `astro check` reported 0 errors, 0 warnings, 0 hints; Astro generated all six `/tools/<slug>/` routes.

## Commands

```text
npm run verify:tools  # exit 0, 26 passed, 0 failed
npm run build         # exit 0, Astro check 0 errors / 0 warnings / 0 hints
git diff --check      # exit 0
```

## Files

- Created `src/data/tools.ts`
- Created `scripts/verify-tools.mjs`
- Created `tests/tools/registry.test.ts`
- Created `src/pages/tools/json.astro`
- Created `src/pages/tools/base64.astro`
- Created `src/pages/tools/url.astro`
- Created `src/pages/tools/timestamp.astro`
- Created `src/pages/tools/uuid.astro`
- Created `src/pages/tools/text-counter.astro`
- Modified `src/pages/tools/index.astro`
- Modified `package.json`

## Self-review

- Verified all six registry slugs map to the expected trailing-slash route URL and to an existing placeholder route.
- Verified category membership and future background-key uniqueness with unit tests.
- Verified the directory imports the registry rather than defining a local title array.
- Verified the directory has search, category-filter, card, empty-state, and result-count contracts; filtering combines normalized Chinese-locale search text with the active category.
- Verified every placeholder intentionally uses `backgroundKey="tools-index"` so the current background registry remains valid.
- Ran `git diff --check`; no whitespace errors were found.

## Concern

The six tool metadata background keys are intentionally not present in `src/data/backgrounds.ts` yet. Task 7 must register those unique backgrounds and replace the six placeholder `tools-index` assignments before the full tool-page interaction work in Task 6.

## Review Fix Round 1

### Major: Derive Route Checks From the Registry

`scripts/verify-tools.mjs` now imports `tools` first and derives each required Astro file from the registered `href`. It no longer maintains an independent route-slug list. The directory import and hook checks, plus unique background-key validation, remain unchanged.

### Test File

- Updated `tests/tools/registry.test.ts`
  - Creates an isolated temporary project with all six legacy route files.
  - Registers only `/tools/missing/` and runs the real verifier as a child process.
  - Requires the verifier to exit 1 and identify `src/pages/tools/missing.astro` as missing.

### Red Evidence

`node --test tests/tools/registry.test.ts` exited 1 before the verifier change.

```text
pass 2
fail 1
AssertionError: 0 !== 1
```

The verifier incorrectly exited 0 while the fixture registry pointed at a route without an Astro page, reproducing the reviewed failure mode.

### Green Evidence

`node --test tests/tools/registry.test.ts` exited 0 after the verifier derives page paths from `tool.href`.

```text
pass 3
fail 0
```

### Command Results

```text
node --test tests/tools/registry.test.ts  # exit 0, 3 passed, 0 failed
npm run verify:tools                      # exit 0, 27 passed, 0 failed
npm run build                             # exit 0, Astro check 0 errors / 0 warnings / 0 hints
```

### Deferred Minor Findings

The category-uniqueness and initial-result-count minor findings were deliberately left unchanged for the requested follow-up workflow.
