import assert from 'node:assert/strict';
import test from 'node:test';
import { readVisitorId } from '../../src/lib/analytics.ts';
import { mountAnalytics } from '../../src/scripts/analytics.ts';
import { normalizeSitePath } from '../../worker/src/validation.ts';

const uuid = '9ac6f2b7-a42b-4cbf-86b8-6539fcf0a010';
const apiUrl = 'https://analytics.example.test/api/';

function storageFixture(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

function fixture(options: { visible?: boolean; storage?: Storage; fetch?: typeof fetch; pathname?: string } = {}) {
  let visibilityState = options.visible === false ? 'hidden' : 'visible';
  const listeners = new Map<string, () => void>();
  const intervals = new Map<number, { callback: () => void; delay: number }>();
  const requests: Array<{ url: string; init: RequestInit }> = [];
  let nextInterval = 0;
  const storage = options.storage ?? storageFixture();
  const document = {
    get visibilityState() { return visibilityState; },
    addEventListener: (name: string, listener: () => void) => { listeners.set(name, listener); },
  } as unknown as Document;
  const window = {
    location: { pathname: options.pathname ?? '/posts/example/' },
    localStorage: storage,
    crypto: { randomUUID: () => uuid },
    fetch: (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return options.fetch?.(url, init) ?? Promise.resolve({ ok: true } as Response);
    },
    setInterval: (callback: () => void, delay: number) => {
      const id = ++nextInterval;
      intervals.set(id, { callback, delay });
      return id;
    },
    clearInterval: (id: number) => { intervals.delete(id); },
  } as unknown as Window;
  return {
    document, window, requests, intervals, storage,
    setVisible(visible: boolean) {
      visibilityState = visible ? 'visible' : 'hidden';
      listeners.get('visibilitychange')?.();
    },
    tick() { for (const { callback } of [...intervals.values()]) callback(); },
  };
}

test('navigation sends one visit with pathname and no visitor ID in URL', () => {
  const app = fixture();
  mountAnalytics(app.document, app.window, apiUrl);
  assert.equal(app.requests.length, 2);
  assert.deepEqual(app.requests.map(({ url }) => url), [apiUrl + 'visit', apiUrl + 'heartbeat']);
  assert.deepEqual(JSON.parse(app.requests[0].init.body as string), { path: '/posts/example/', visitorId: uuid });
  assert.equal(app.requests[0].init.method, 'POST');
  assert.equal((app.requests[0].init.headers as Record<string, string>)['Content-Type'], 'application/json');
});

test('encoded published Chinese tag path becomes a Worker-accepted visit path', () => {
  const pathname = new URL('https://bigbrotherwei.github.io/tags/博客重构/').pathname;
  const app = fixture({ pathname });
  mountAnalytics(app.document, app.window, apiUrl);
  const path = JSON.parse(app.requests[0].init.body as string).path;
  assert.equal(path, '/tags/博客重构/');
  assert.equal(normalizeSitePath(path), '/tags/博客重构/');
});

test('encoded separators and malformed escapes are not sent as visits', () => {
  for (const pathname of ['/tags/博客%2F重构/', '/tags/博客%252F重构/', '/tags/%E5%BD/']) {
    const app = fixture({ pathname });
    assert.doesNotThrow(() => mountAnalytics(app.document, app.window, apiUrl));
    assert.equal(app.requests.some(({ url }) => url.endsWith('/visit')), false);
  }
});

test('visible tab sends an immediate heartbeat and repeats every 30 seconds', () => {
  const app = fixture();
  mountAnalytics(app.document, app.window, apiUrl);
  assert.deepEqual([...app.intervals.values()].map(({ delay }) => delay), [30_000]);
  app.tick();
  app.tick();
  assert.deepEqual(app.requests.map(({ url }) => url), [apiUrl + 'visit', apiUrl + 'heartbeat', apiUrl + 'heartbeat', apiUrl + 'heartbeat']);
  assert.deepEqual(JSON.parse(app.requests[3].init.body as string), { visitorId: uuid });
});

test('hidden tab stops heartbeats and resumes immediately on visibility', () => {
  const app = fixture({ visible: false });
  mountAnalytics(app.document, app.window, apiUrl);
  assert.deepEqual(app.requests.map(({ url }) => url), [apiUrl + 'visit']);
  app.setVisible(true);
  assert.equal(app.requests.length, 2);
  app.setVisible(false);
  assert.equal(app.intervals.size, 0);
  app.tick();
  assert.equal(app.requests.length, 2);
  app.setVisible(true);
  assert.equal(app.requests.length, 3);
  assert.equal(app.requests.filter(({ url }) => url.endsWith('/visit')).length, 1);
});

test('another tab reuses the stored UUID', () => {
  const storage = storageFixture();
  assert.equal(readVisitorId(storage, () => uuid), uuid);
  assert.equal(readVisitorId(storage, () => { throw new Error('must reuse'); }), uuid);
  const app = fixture({ storage });
  mountAnalytics(app.document, app.window, apiUrl);
  assert.equal(JSON.parse(app.requests[0].init.body as string).visitorId, uuid);
});

test('unavailable localStorage disables telemetry', () => {
  const app = fixture();
  Object.defineProperty(app.window, 'localStorage', { get() { throw new Error('blocked'); } });
  assert.doesNotThrow(() => mountAnalytics(app.document, app.window, apiUrl));
  assert.equal(app.requests.length, 0);
  assert.equal(app.intervals.size, 0);
});

test('failed storage write disables telemetry', () => {
  const storage = storageFixture();
  storage.setItem = () => { throw new Error('quota'); };
  const app = fixture({ storage });
  mountAnalytics(app.document, app.window, apiUrl);
  assert.equal(app.requests.length, 0);
  assert.equal(app.intervals.size, 0);
});

test('missing API URL makes no request or timer', () => {
  const app = fixture();
  mountAnalytics(app.document, app.window, '');
  assert.equal(app.requests.length, 0);
  assert.equal(app.intervals.size, 0);
});

test('network failure never throws into page code', async () => {
  const app = fixture({ fetch: () => Promise.reject(new Error('offline')) });
  assert.doesNotThrow(() => mountAnalytics(app.document, app.window, apiUrl));
  app.tick();
  app.setVisible(false);
  app.setVisible(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.requests.length, 4);
});
