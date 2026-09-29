import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import worker from "../src/index";
import { hashVisitorId } from "../src/identity";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

const origin = "https://bigbrotherwei.github.io";
const secret = "test-secret-for-local-worker-only";
const workerEnv = { DB: env.DB, VISITOR_HMAC_KEY: secret, ALLOWED_ORIGINS: `${origin},http://localhost:4321` };
const visitorId = "9ac6f2b7-a42b-4cbf-86b8-6539fcf0a010";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

afterEach(() => vi.restoreAllMocks());

function at(seconds: number) {
  vi.spyOn(Date, "now").mockReturnValue(seconds * 1000);
}

function request(route: string, init: RequestInit = {}) {
  return worker.fetch(new Request(`https://analytics.example${route}`, {
    ...init,
    headers: { Origin: origin, ...init.headers },
  }), workerEnv);
}

function post(route: string, body: unknown, init: RequestInit = {}) {
  return request(route, {
    ...init,
    method: "POST",
    headers: { "Content-Type": "application/json", ...init.headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function totals() {
  return env.DB.prepare("SELECT pv, uv FROM site_totals WHERE id = 1").first<{ pv: number; uv: number }>();
}

test("allowed origin records a visit and returns site and article counts without caching or credentials", async () => {
  at(1000);
  const response = await post("/visit", { path: "/posts/api-test/", visitorId });
  expect(response.status).toBe(200);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ ok: true });
  expect(await (await request("/stats?path=/posts/api-test/")).json()).toEqual({ reads: 1 });
  expect(await (await request("/stats?path=/")).json()).toEqual({ pv: 1, uv: 1, online: 1 });
});

test("invalid origin, media type, body size, ID, route and path never alter counts", async () => {
  const before = await totals();
  const bad = [
    post("/visit", { path: "/", visitorId }, { headers: { Origin: "https://unrelated.example" } }),
    post("/visit", { path: "/", visitorId }, { headers: { "Content-Type": "text/plain" } }),
    post("/visit", { path: "/", visitorId, padding: "x".repeat(3000) }),
    post("/visit", { path: "/", visitorId: "not-a-uuid" }),
    post("/visit", { path: "https://example.com/", visitorId }),
    post("/visit", { path: "/posts/example/?q=1", visitorId }),
    post("/visit", { path: "/unknown/", visitorId }),
    post("/visit", { path: "/", visitorId, extra: true }),
    post("/visit", "{invalid"),
  ];
  for (const response of await Promise.all(bad)) expect(response.status).toBeGreaterThanOrEqual(400);
  expect((await request("/stats?path=/about/")).status).toBe(400);
  expect((await request("/stats?path=/posts/")).status).toBe(400);
  expect((await request("/stats?path=https://example.com/")).status).toBe(400);
  expect((await request("/stats?path=/posts/api-test/&extra=1")).status).toBe(400);
  expect((await request("/no-route")).status).toBe(404);
  expect(await totals()).toEqual(before);
});

test.each([undefined, "10"])("oversized streamed body is canceled with Content-Length %s", async (length) => {
  let canceled = false;
  let produced = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      produced++;
      controller.enqueue(new Uint8Array(2049));
      if (produced === 10) controller.close();
    },
    cancel() { canceled = true; },
  });
  const headers: Record<string, string> = { Origin: origin, "Content-Type": "application/json" };
  if (length) headers["Content-Length"] = length;
  const response = await worker.fetch(new Request("https://analytics.example/visit", {
    method: "POST", headers, body,
  }), workerEnv);
  expect(response.status).toBe(400);
  expect(canceled).toBe(true);
  expect(produced).toBeLessThan(4);
});

test("duplicate at four seconds does not move the five-second eligibility boundary", async () => {
  const id = "267b64d9-f06e-4383-8cef-f47733c02ec1";
  const before = await totals();
  at(2000);
  expect((await post("/visit", { path: "/topics/test/", visitorId: id })).status).toBe(200);
  at(2004);
  expect((await post("/visit", { path: "/topics/test/", visitorId: id })).status).toBe(200);
  at(2005);
  expect((await post("/visit", { path: "/topics/test/", visitorId: id })).status).toBe(200);
  const after = await totals();
  expect(after).toEqual({ pv: before!.pv + 2, uv: before!.uv + 1 });
  const hash = await hashVisitorId(secret, id);
  expect(await env.DB.prepare("SELECT last_at FROM recent_visits WHERE visitor_hash = ? AND path = ?").bind(hash, "/topics/test/").first()).toEqual({ last_at: 2005 });
});

test("published Chinese tag slugs are valid visit paths", async () => {
  at(2500);
  const response = await post("/visit", { path: "/tags/博客重构/", visitorId: "8282b96d-960d-46b3-b985-99696e9dcc86" });
  expect(response.status).toBe(200);
});

test("two tabs with one ID count online once and heartbeat expires at 90 seconds", async () => {
  const id = "3f1a93c5-92a6-4584-940c-e9bfe9549dc0";
  at(3000);
  expect((await post("/heartbeat", { visitorId: id })).status).toBe(200);
  expect((await post("/heartbeat", { visitorId: id })).status).toBe(200);
  expect((await (await request("/stats?path=/")).json() as { online: number }).online).toBe(1);
  const hash = await hashVisitorId(secret, id);
  expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM presence WHERE visitor_hash = ?").bind(hash).first()).toEqual({ count: 1 });
  at(3090);
  expect((await (await request("/stats?path=/")).json() as { online: number }).online).toBe(0);
});

test("D1 abort returns 503 and rolls back all visit counts", async () => {
  const id = "91eb7c60-f30b-4f0e-88cf-bd70f75da92e";
  const hash = await hashVisitorId(secret, id);
  const before = await totals();
  await env.DB.prepare(`CREATE TRIGGER fail_presence BEFORE INSERT ON presence
    WHEN NEW.visitor_hash = '${hash}' BEGIN SELECT RAISE(ABORT, 'test failure'); END`).run();
  try {
    at(4000);
    expect((await post("/visit", { path: "/", visitorId: id })).status).toBe(503);
    expect(await totals()).toEqual(before);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM visitors WHERE visitor_hash = ?").bind(hash).first()).toEqual({ count: 0 });
  } finally {
    await env.DB.prepare("DROP TRIGGER fail_presence").run();
  }
});

test("scheduled cleanup removes presence and recent visits older than 24 hours", async () => {
  expect((await env.DB.prepare("SELECT COUNT(*) AS count FROM presence").first<{ count: number }>())!.count).toBeGreaterThan(0);
  expect((await env.DB.prepare("SELECT COUNT(*) AS count FROM recent_visits").first<{ count: number }>())!.count).toBeGreaterThan(0);
  at(100_000);
  await worker.scheduled({} as ScheduledEvent, workerEnv);
  expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM presence").first()).toEqual({ count: 0 });
  expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM recent_visits").first()).toEqual({ count: 0 });
});
