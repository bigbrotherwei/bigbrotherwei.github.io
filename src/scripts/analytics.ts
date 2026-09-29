import { readVisitorId } from '../lib/analytics.ts';

const visits = new WeakMap<Window, Promise<boolean>>();

export function navigationVisit(window: Window, base: URL): Promise<boolean> {
  const existing = visits.get(window);
  if (existing) return existing;
  const visit = (async () => {
    try {
      const visitorId = readVisitorId(window.localStorage, () => window.crypto.randomUUID());
      const path = decodeURI(window.location.pathname);
      if (!visitorId || path.includes('%')) return false;
      const response = await window.fetch(new URL('visit', base).href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, visitorId }),
      });
      return response.ok;
    } catch {
      return false;
    }
  })();
  visits.set(window, visit);
  return visit;
}

export function mountAnalytics(document: Document, window: Window, apiUrl: string): void {
  if (!apiUrl?.trim()) return;

  let base: URL;
  try {
    base = new URL(apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`);
    if (!['https:', 'http:'].includes(base.protocol)) return;
  } catch {
    return;
  }

  let visitorId: string | null;
  try {
    visitorId = readVisitorId(window.localStorage, () => window.crypto.randomUUID());
  } catch {
    return;
  }
  if (!visitorId) return;

  const post = (route: string, body: object): void => {
    try {
      void window.fetch(new URL(route, base).href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {});
    } catch {
      // Analytics must never interrupt the page.
    }
  };

  void navigationVisit(window, base);

  let interval: number | null = null;
  const updatePresence = (): void => {
    if (document.visibilityState !== 'visible') {
      if (interval !== null) window.clearInterval(interval);
      interval = null;
      return;
    }
    if (interval !== null) return;
    post('heartbeat', { visitorId });
    interval = window.setInterval(() => post('heartbeat', { visitorId }), 30_000);
  };

  document.addEventListener('visibilitychange', updatePresence);
  updatePresence();
}
