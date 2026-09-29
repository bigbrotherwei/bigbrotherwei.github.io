import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
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
    fetch: (url: string) => { requests.push(url); return response(); },
  } as unknown as Window;
  return { root, window, requests, values };
}

test('home maps pv, uv and online to their own labels', async () => {
  const app = fixture(['pv', 'uv', 'online'], '/', async () => ({ ok: true, json: async () => ({ pv: 12, uv: 8, online: 2 }) }) as Response);
  await mountStatsDisplay(app.root, app.window, apiUrl);
  assert.equal(app.requests[0], `${apiUrl}stats?path=%2F`);
  assert.deepEqual([...app.values.values()].map((value) => value.textContent), ['12', '8', '2']);
  assert.equal(app.root.dataset.state, 'ready');
});

test('article renders reads only', async () => {
  const app = fixture(['reads'], '/posts/example/', async () => ({ ok: true, json: async () => ({ reads: 27, pv: 900 }) }) as Response);
  await mountStatsDisplay(app.root, app.window, apiUrl);
  assert.equal(app.requests[0], `${apiUrl}stats?path=%2Fposts%2Fexample%2F`);
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
