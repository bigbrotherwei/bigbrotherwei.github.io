import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mountAnalytics } from '../../src/scripts/analytics.ts';
import { mountStatsDisplay } from '../../src/scripts/stats-display.ts';

const apiUrl = 'https://analytics.example.test/api/';

function fixture(keys: string[], path: string, response: () => Promise<Response>) {
  const values = new Map(keys.map((key) => [key, { textContent: '加载中' }]));
  const requests: string[] = [];
  const root = {
    dataset: { statsPath: path, state: 'loading' },
    querySelectorAll: () => [...values].map(([key, value]) => ({ dataset: { statKey: key }, ...value,
      set textContent(text: string) { value.textContent = text; },
    })),
  } as unknown as HTMLElement;
  const window = {
    location: { pathname: path },
    localStorage: { getItem: () => '9ac6f2b7-a42b-4cbf-86b8-6539fcf0a010' },
    fetch: (url: string) => { requests.push(url); return url.endsWith('/visit') ? Promise.resolve({ ok: true } as Response) : response(); },
  } as unknown as Window;
  return { root, window, requests, values };
}

test('home maps pv, uv and online to their own labels', async () => {
  const app = fixture(['pv', 'uv', 'online'], '/', async () => ({ ok: true, json: async () => ({ pv: 12, uv: 8, online: 2 }) }) as Response);
  await mountStatsDisplay(app.root, app.window, apiUrl);
  assert.equal(app.requests[1], `${apiUrl}stats?path=%2F`);
  assert.deepEqual([...app.values.values()].map((value) => value.textContent), ['12', '8', '2']);
  assert.equal(app.root.dataset.state, 'ready');
});

test('article renders reads only', async () => {
  const app = fixture(['reads'], '/posts/example/', async () => ({ ok: true, json: async () => ({ reads: 27, pv: 900 }) }) as Response);
  await mountStatsDisplay(app.root, app.window, apiUrl);
  assert.equal(app.requests[1], `${apiUrl}stats?path=%2Fposts%2Fexample%2F`);
  assert.equal(app.values.get('reads')?.textContent, '27');
  assert.equal(app.root.dataset.state, 'ready');
});

test('zero appears only after a successful response', async () => {
  const app = fixture(['pv', 'uv', 'online'], '/', async () => ({ ok: true, json: async () => ({ pv: 0, uv: 0, online: 0 }) }) as Response);
  assert.deepEqual([...app.values.values()].map((value) => value.textContent), ['加载中', '加载中', '加载中']);
  await mountStatsDisplay(app.root, app.window, apiUrl);
  assert.deepEqual([...app.values.values()].map((value) => value.textContent), ['0', '0', '0']);
});

test('HTTP failure displays unavailable, never zero', async () => {
  const app = fixture(['reads'], '/posts/example/', async () => ({ ok: false }) as Response);
  await mountStatsDisplay(app.root, app.window, apiUrl);
  assert.equal(app.values.get('reads')?.textContent, '暂不可用');
  assert.equal(app.root.dataset.state, 'unavailable');
});

test('stats wait for this navigation visit and failed visit leaves no stale counts', async () => {
  for (const path of ['/', '/posts/example/']) {
    let settle!: (response: Response) => void;
    const visit = new Promise<Response>((resolve) => { settle = resolve; });
    const key = path === '/' ? 'pv' : 'reads';
    const app = fixture([key], path, async () => ({ ok: true, json: async () => ({ [key]: 41 }) }) as Response);
    app.window.fetch = ((url: string) => {
      app.requests.push(url);
      return url.endsWith('/visit') ? visit : Promise.resolve({ ok: true, json: async () => ({ [key]: 41 }) } as Response);
    }) as typeof fetch;
    const pending = mountStatsDisplay(app.root, app.window, apiUrl);
    assert.deepEqual(app.requests, [`${apiUrl}visit`]);
    settle({ ok: false } as Response);
    await pending;
    assert.deepEqual(app.requests, [`${apiUrl}visit`]);
    assert.equal(app.values.get(key)?.textContent, '暂不可用');
  }
});

test('controller and display share one visit before showing the new count', async () => {
  let settle!: (response: Response) => void;
  const visit = new Promise<Response>((resolve) => { settle = resolve; });
  const app = fixture(['reads'], '/posts/example/', async () => ({ ok: true, json: async () => ({ reads: 12 }) }) as Response);
  app.window.fetch = ((url: string) => {
    app.requests.push(url);
    return url.endsWith('/visit') ? visit : Promise.resolve(url.endsWith('/heartbeat')
      ? { ok: true } as Response
      : { ok: true, json: async () => ({ reads: 12 }) } as Response);
  }) as typeof fetch;
  const document = {
    visibilityState: 'visible',
    addEventListener: () => {},
  } as unknown as Document;
  app.window.setInterval = (() => 1) as unknown as Window['setInterval'];
  mountAnalytics(document, app.window, apiUrl);
  const pending = mountStatsDisplay(app.root, app.window, apiUrl);
  assert.equal(app.requests.filter((url) => url.endsWith('/visit')).length, 1);
  assert.equal(app.requests.some((url) => url.includes('/stats?')), false);
  settle({ ok: true } as Response);
  await pending;
  assert.equal(app.values.get('reads')?.textContent, '12');
});

test('home online refreshes while visible without overlap and stops while hidden', async () => {
  const app = fixture(['pv', 'uv', 'online'], '/', async () => ({ ok: true, json: async () => ({ pv: 1, uv: 1, online: 1 }) }) as Response);
  let visible = true;
  let refresh: (() => void) | undefined;
  let active = false;
  let resolveRefresh!: (response: Response) => void;
  let statsCalls = 0;
  const listeners = new Map<string, () => void>();
  Object.defineProperty(app.window, 'document', { value: {
    get visibilityState() { return visible ? 'visible' : 'hidden'; },
    addEventListener: (name: string, listener: () => void) => { listeners.set(name, listener); },
  } as unknown as Document });
  app.window.setInterval = ((callback: () => void, delay: number) => { assert.equal(delay, 30_000); active = true; refresh = callback; return 1; }) as typeof setInterval;
  app.window.clearInterval = (() => { active = false; refresh = undefined; }) as typeof clearInterval;
  app.window.fetch = (async (url: string) => {
    app.requests.push(url);
    if (url.endsWith('/visit')) return { ok: true } as Response;
    statsCalls++;
    if (statsCalls === 1) return { ok: true, json: async () => ({ pv: 1, uv: 1, online: 1 }) } as Response;
    return new Promise<Response>((resolve) => { resolveRefresh = resolve; });
  }) as typeof fetch;
  await mountStatsDisplay(app.root, app.window, apiUrl);
  assert.equal(active, true);
  refresh?.();
  refresh?.();
  assert.equal(statsCalls, 2);
  resolveRefresh({ ok: true, json: async () => ({ pv: 1, uv: 1, online: 2 }) } as Response);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.values.get('online')?.textContent, '2');
  visible = false;
  listeners.get('visibilitychange')?.();
  assert.equal(active, false);
  visible = true;
  listeners.get('visibilitychange')?.();
  assert.equal(statsCalls, 3);
});

test('home loaded while hidden refreshes immediately when first shown', async () => {
  const app = fixture(['pv', 'uv', 'online'], '/', async () => ({ ok: true, json: async () => ({ pv: 1, uv: 1, online: 1 }) }) as Response);
  let visible = false;
  let statsCalls = 0;
  let onVisibilityChange: (() => void) | undefined;
  Object.defineProperty(app.window, 'document', { value: {
    get visibilityState() { return visible ? 'visible' : 'hidden'; },
    addEventListener: (_name: string, listener: () => void) => { onVisibilityChange = listener; },
  } as unknown as Document });
  app.window.setInterval = (() => 1) as unknown as Window['setInterval'];
  app.window.fetch = (async (url: string) => {
    if (url.endsWith('/visit')) return { ok: true } as Response;
    statsCalls++;
    return { ok: true, json: async () => ({ pv: 1, uv: 1, online: statsCalls }) } as Response;
  }) as typeof fetch;
  await mountStatsDisplay(app.root, app.window, apiUrl);
  assert.equal(statsCalls, 1);
  visible = true;
  onVisibilityChange?.();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(statsCalls, 2);
  assert.equal(app.values.get('online')?.textContent, '2');
});

test('missing configuration and malformed payload display unavailable', async () => {
  const app = fixture(['pv', 'uv', 'online'], '/', async () => ({ ok: true, json: async () => ({ pv: 2, uv: null, online: 0 }) }) as Response);
  await mountStatsDisplay(app.root, app.window, apiUrl);
  assert.deepEqual([...app.values.values()].map((value) => value.textContent), ['暂不可用', '暂不可用', '暂不可用']);
  const noUrl = fixture(['reads'], '/posts/example/', async () => { throw new Error('unexpected request'); });
  await mountStatsDisplay(noUrl.root, noUrl.window, '');
  assert.equal(noUrl.values.get('reads')?.textContent, '暂不可用');
  assert.equal(noUrl.requests.length, 0);
});

test('both visible surfaces link to privacy and are ignored by Pagefind', () => {
  for (const component of ['SiteStats', 'ArticleReads']) {
    const source = readFileSync(new URL(`../../src/components/${component}.astro`, import.meta.url), 'utf8');
    assert.match(source, /href="\/privacy\/"/);
    assert.match(source, /data-pagefind-ignore/);
  }
});
