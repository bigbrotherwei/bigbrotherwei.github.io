import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { beforeAll, expect, test } from "vitest";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

test("counts first visit and only accepts a repeat after five seconds", async () => {
  const visitor = "visitor-one";
  const path = "/posts/example/";
  const totals = () => env.DB.prepare("SELECT pv, uv FROM site_totals WHERE id = 1").first<{ pv: number; uv: number }>();
  const article = () => env.DB.prepare("SELECT pv FROM article_views WHERE path = ?").bind(path).first<{ pv: number }>();
  const visit = (at: number) => env.DB.prepare(`
    INSERT INTO recent_visits (visitor_hash, path, last_at) VALUES (?, ?, ?)
    ON CONFLICT (visitor_hash, path) DO UPDATE SET last_at = excluded.last_at
    WHERE recent_visits.last_at <= excluded.last_at - 5
  `).bind(visitor, path, at).run();

  await env.DB.prepare("INSERT INTO visitors (visitor_hash) VALUES (?)").bind(visitor).run();
  await visit(100);
  expect(await totals()).toEqual({ pv: 1, uv: 1 });
  expect(await article()).toEqual({ pv: 1 });

  await visit(104);
  expect(await totals()).toEqual({ pv: 1, uv: 1 });
  expect(await article()).toEqual({ pv: 1 });

  await visit(105);
  expect(await totals()).toEqual({ pv: 2, uv: 1 });
  expect(await article()).toEqual({ pv: 2 });
});
