import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("verify:tools runs TypeScript tests with Node 22 type stripping enabled", () => {
  const script = packageJson.scripts?.["verify:tools"];

  assert.equal(
    script,
    "node --experimental-strip-types --test tests/tools/*.test.ts && node scripts/verify-tools.mjs",
  );
});
