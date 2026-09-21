import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const registryTest = readFileSync("tests/tools/registry.test.ts", "utf8");

test("verify:tools runs every TypeScript entry with Node 22 type stripping enabled", () => {
  const script = packageJson.scripts?.["verify:tools"];

  assert.equal(
    script,
    "node --experimental-strip-types --test tests/tools/*.test.ts && node --experimental-strip-types scripts/verify-tools.mjs",
  );
});

test("registry verifier subprocess keeps Node 22 type stripping enabled for fixtures", () => {
  assert.match(
    registryTest,
    /spawnSync\(process\.execPath,\s*\[\s*'--experimental-strip-types',\s*fileURLToPath\(verifierPath\)\s*\]/s,
  );
});
