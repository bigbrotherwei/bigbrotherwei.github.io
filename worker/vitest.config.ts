import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const workerDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: workerDir,
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: path.join(workerDir, "wrangler.jsonc") },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(workerDir, "migrations")),
        },
      },
    })),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
