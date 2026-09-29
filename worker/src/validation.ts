const staticPaths = new Set([
  "/", "/about/", "/archive/", "/privacy/", "/search/",
  "/posts/", "/topics/", "/projects/", "/tags/", "/tools/",
]);
const detailPath = /^\/(posts|topics|projects|tags|tools)\/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*\/$/u;

export function normalizeSitePath(path: string): string | null {
  if (path.length > 200 || !path.startsWith("/") || path.includes("?") || path.includes("#")) return null;
  return staticPaths.has(path) || detailPath.test(path) ? path : null;
}

export function isVisitorId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
