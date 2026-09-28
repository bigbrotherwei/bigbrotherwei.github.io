import { hashVisitorId } from "./identity";
import { isVisitorId, normalizeSitePath } from "./validation";

interface Env {
  DB: D1Database;
  VISITOR_HMAC_KEY: string;
  ALLOWED_ORIGINS: string;
}

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

function respond(body: object, status: number, origin?: string): Response {
  const headers = new Headers(jsonHeaders);
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function readBody(request: Request, keys: string[]): Promise<Record<string, unknown> | null> {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get("Content-Type") ?? "")) return null;
  const length = Number(request.headers.get("Content-Length"));
  if (length > 2048) return null;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 2048) return null;
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length !== keys.length || keys.some((key) => !Object.hasOwn(record, key))) return null;
    return record;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const allowed = env.ALLOWED_ORIGINS?.split(",").map((entry) => entry.trim()).filter(Boolean) ?? [];
    if (!origin || !allowed.includes(origin)) return respond({ error: "Forbidden" }, 403);

    const url = new URL(request.url);
    const route = url.pathname;
    if (!["/visit", "/heartbeat", "/stats"].includes(route)) return respond({ error: "Not found" }, 404, origin);
    if (url.search && route !== "/stats") return respond({ error: "Bad request" }, 400, origin);

    if (request.method === "OPTIONS") {
      const headers = new Headers({ "Cache-Control": "no-store", "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": route === "/stats" ? "GET, OPTIONS" : "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" });
      return new Response(null, { status: 204, headers });
    }

    if (request.method === "GET" && route === "/stats") {
      const paths = url.searchParams.getAll("path");
      if (paths.length !== 1 || url.searchParams.size !== 1) return respond({ error: "Bad request" }, 400, origin);
      const path = normalizeSitePath(paths[0]);
      if (path !== "/" && (!path?.startsWith("/posts/") || path === "/posts/")) return respond({ error: "Bad request" }, 400, origin);
      try {
        if (path === "/") {
          const now = Math.floor(Date.now() / 1000);
          const [totals, online] = await env.DB.batch([
            env.DB.prepare("SELECT pv, uv FROM site_totals WHERE id = 1"),
            env.DB.prepare("SELECT COUNT(*) AS count FROM presence WHERE last_seen > ?").bind(now - 90),
          ]);
          const row = totals.results[0] as { pv: number; uv: number } | undefined;
          const count = online.results[0] as { count: number } | undefined;
          if (!row || !count) throw new Error("Missing statistics rows");
          return respond({ pv: row.pv, uv: row.uv, online: count.count }, 200, origin);
        }
        const row = await env.DB.prepare("SELECT pv FROM article_views WHERE path = ?").bind(path).first<{ pv: number }>();
        return respond({ reads: row?.pv ?? 0 }, 200, origin);
      } catch {
        return respond({ error: "Unavailable" }, 503, origin);
      }
    }

    if (request.method !== "POST" || route === "/stats") return respond({ error: "Method not allowed" }, 405, origin);
    const body = await readBody(request, route === "/visit" ? ["path", "visitorId"] : ["visitorId"]);
    if (!body || !isVisitorId(body.visitorId)) return respond({ error: "Bad request" }, 400, origin);
    const path = route === "/visit" && typeof body.path === "string" ? normalizeSitePath(body.path) : null;
    if (route === "/visit" && !path) return respond({ error: "Bad request" }, 400, origin);
    if (!env.VISITOR_HMAC_KEY) return respond({ error: "Unavailable" }, 503, origin);

    try {
      const hash = await hashVisitorId(env.VISITOR_HMAC_KEY, body.visitorId);
      const now = Math.floor(Date.now() / 1000);
      const presence = env.DB.prepare(`INSERT INTO presence (visitor_hash, last_seen) VALUES (?, ?)
        ON CONFLICT (visitor_hash) DO UPDATE SET last_seen = excluded.last_seen`).bind(hash, now);
      if (route === "/visit") {
        await env.DB.batch([
          env.DB.prepare("INSERT OR IGNORE INTO visitors (visitor_hash) VALUES (?)").bind(hash),
          env.DB.prepare(`INSERT INTO recent_visits (visitor_hash, path, last_at) VALUES (?, ?, ?)
            ON CONFLICT (visitor_hash, path) DO UPDATE SET last_at = excluded.last_at
            WHERE recent_visits.last_at <= excluded.last_at - 5`).bind(hash, path, now),
          presence,
        ]);
      } else {
        await presence.run();
      }
      return respond({ ok: true }, 200, origin);
    } catch {
      return respond({ error: "Unavailable" }, 503, origin);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const cutoff = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
    await env.DB.batch([
      env.DB.prepare("DELETE FROM presence WHERE last_seen < ?").bind(cutoff),
      env.DB.prepare("DELETE FROM recent_visits WHERE last_at < ?").bind(cutoff),
    ]);
  },
};
