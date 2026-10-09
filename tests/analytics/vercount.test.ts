import assert from 'node:assert/strict';
import test from 'node:test';
import { mountVercount } from '../../src/scripts/vercount.ts';

function fixture(withCounters = true) {
  const values = withCounters ? [{ textContent: '加载中' }, { textContent: '加载中' }] : [];
  const root = { dataset: { state: 'loading' }, querySelectorAll: () => values };
  const scripts: Array<{ src: string; async: boolean; onerror?: () => void }> = [];
  let notifyMutation: (() => void) | undefined;
  let onTimeout: (() => void) | undefined;
  let disconnected = false;
  const removedKeys: string[] = [];
  const document = {
    querySelectorAll: (selector: string) => selector === '[data-vercount-stats]' && withCounters ? [root] : [],
    createElement: () => ({ src: '', async: false }),
    body: { appendChild: (script: typeof scripts[number]) => { scripts.push(script); } },
  } as unknown as Document;
  const window = {
    MutationObserver: class {
      constructor(callback: () => void) { notifyMutation = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    },
    setTimeout: (callback: () => void) => { onTimeout = callback; return 1; },
    clearTimeout: () => { onTimeout = undefined; },
    localStorage: { removeItem: (key: string) => { removedKeys.push(key); } },
  } as unknown as Window;
  return { document, window, root, values, scripts, removedKeys, notify: () => notifyMutation?.(), timeout: () => onTimeout?.(), get disconnected() { return disconnected; } };
}

test('loads the official Vercount script once on every page', () => {
  const app = fixture(false);
  mountVercount(app.document, app.window);
  assert.equal(app.scripts.length, 1);
  assert.equal(app.scripts[0].src, 'https://events.vercount.one/js');
  assert.equal(app.scripts[0].async, true);
  assert.deepEqual(app.removedKeys, ['analytics-visitor-id']);
});

test('counter updates mark the statistics as ready', () => {
  const app = fixture();
  mountVercount(app.document, app.window);
  app.values[0].textContent = '12';
  app.values[1].textContent = '8';
  app.notify();
  assert.equal(app.root.dataset.state, 'ready');
  assert.equal(app.disconnected, true);
});

test('script failure and timeout never leave loading placeholders behind', () => {
  for (const fail of [(app: ReturnType<typeof fixture>) => app.scripts[0].onerror?.(), (app: ReturnType<typeof fixture>) => app.timeout()]) {
    const app = fixture();
    mountVercount(app.document, app.window);
    fail(app);
    assert.deepEqual(app.values.map((value) => value.textContent), ['暂不可用', '暂不可用']);
    assert.equal(app.root.dataset.state, 'unavailable');
  }
});
