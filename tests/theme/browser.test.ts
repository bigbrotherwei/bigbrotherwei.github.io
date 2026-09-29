import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { mountTheme } from '../../src/scripts/theme.ts';

type Listener = (event: { detail?: unknown }) => void;

function fixture(options: { dark?: boolean; stored?: string | null; blocked?: boolean; media?: boolean } = {}) {
  const attributes = new Map<string, string>();
  const events: Array<{ theme: string }> = [];
  const listeners = new Map<string, Listener>();
  const storage = new Map<string, string>();
  if (options.stored !== undefined && options.stored !== null) storage.set('blog-theme-preference', options.stored);
  const root = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => { attributes.set(name, value); },
  };
  let dark = options.dark ?? false;
  let systemListener: (() => void) | undefined;
  const media = {
    get matches() { return dark; },
    addEventListener: (_name: string, listener: () => void) => { systemListener = listener; },
  };
  const document = {
    documentElement: root,
    addEventListener: (name: string, listener: Listener) => { listeners.set(name, listener); },
    dispatchEvent: (event: { type: string; detail: { theme: string } }) => {
      if (event.type === 'themechange') events.push(event.detail);
      listeners.get(event.type)?.(event);
      return true;
    },
  } as unknown as Document;
  const window = {
    get localStorage() { if (options.blocked) throw new Error('storage blocked'); return {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    }; },
    matchMedia: options.media === false ? undefined : () => media,
  } as unknown as Window;
  return {
    document, window, root, events, storage,
    select(preference: string) { listeners.get('themepreferencechange')?.({ detail: { preference } }); },
    systemDark(value: boolean) { dark = value; systemListener?.(); },
  };
}

function prepaint(app: ReturnType<typeof fixture>): void {
  const layout = readFileSync(new URL('../../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
  const script = layout.match(/<script is:inline data-theme-prepaint>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'layout includes an inline prepaint script');
  runInNewContext(script, { document: app.document, window: app.window });
}

test('prepaint follows system on first visit and controller preserves it', () => {
  const app = fixture({ dark: true });
  prepaint(app);
  assert.equal(app.root.getAttribute('data-theme-preference'), 'system');
  assert.equal(app.root.getAttribute('data-theme'), 'dark');
  mountTheme(app.document, app.window);
  assert.deepEqual(app.events, []);
  app.systemDark(false);
  assert.equal(app.root.getAttribute('data-theme'), 'light');
  assert.deepEqual(app.events, [{ theme: 'light' }]);
});

test('explicit selection persists across a new page and ignores system changes', () => {
  const app = fixture({ dark: true });
  prepaint(app);
  mountTheme(app.document, app.window);
  app.select('light');
  assert.equal(app.storage.get('blog-theme-preference'), 'light');
  assert.equal(app.root.getAttribute('data-theme-preference'), 'light');
  assert.equal(app.root.getAttribute('data-theme'), 'light');
  assert.deepEqual(app.events, [{ theme: 'light' }]);
  app.systemDark(false);
  app.systemDark(true);
  assert.deepEqual(app.events, [{ theme: 'light' }]);

  const next = fixture({ dark: true, stored: app.storage.get('blog-theme-preference') ?? null });
  prepaint(next);
  assert.equal(next.root.getAttribute('data-theme'), 'light');
  mountTheme(next.document, next.window);
  assert.equal(next.root.getAttribute('data-theme-preference'), 'light');
});

test('invalid stored values and unavailable browser APIs fall back safely', () => {
  for (const app of [fixture({ dark: true, stored: 'blue' }), fixture({ blocked: true, media: false })]) {
    assert.doesNotThrow(() => prepaint(app));
    assert.equal(app.root.getAttribute('data-theme-preference'), 'system');
    assert.doesNotThrow(() => mountTheme(app.document, app.window));
  }
  const blocked = fixture({ blocked: true, dark: false });
  prepaint(blocked);
  mountTheme(blocked.document, blocked.window);
  blocked.select('dark');
  assert.equal(blocked.root.getAttribute('data-theme'), 'dark');
  assert.deepEqual(blocked.events, [{ theme: 'dark' }]);
});

test('switching back to system uses current appearance and rejects invalid selections', () => {
  const app = fixture({ dark: true, stored: 'light' });
  prepaint(app);
  mountTheme(app.document, app.window);
  app.select('system');
  assert.equal(app.root.getAttribute('data-theme'), 'dark');
  assert.equal(app.storage.get('blog-theme-preference'), 'system');
  app.select('unexpected');
  assert.equal(app.root.getAttribute('data-theme-preference'), 'system');
  assert.deepEqual(app.events, [{ theme: 'dark' }]);
});
