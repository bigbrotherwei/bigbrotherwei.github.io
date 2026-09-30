import assert from 'node:assert/strict';
import test from 'node:test';
import { mountArticleComments } from '../../src/scripts/article-comments.ts';
import { mountTheme } from '../../src/scripts/theme.ts';

test('theme controller updates an already loaded Giscus frame when system appearance changes', () => {
  const rootAttributes = new Map([['data-theme', 'light'], ['data-theme-preference', 'system']]);
  const root = {
    getAttribute: (name: string) => rootAttributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => { rootAttributes.set(name, value); },
  };
  const sectionAttributes = new Map([
    ['data-repo', 'owner/repo'], ['data-repo-id', 'repo-id'],
    ['data-category', 'Comments'], ['data-category-id', 'category-id'],
    ['data-mapping', 'pathname'], ['data-strict', '1'], ['data-lang', 'zh-CN'],
  ]);
  const embedChildren: Array<{ tagName: string; attributes?: Map<string, string>; contentWindow?: unknown }> = [];
  const buttonListeners = new Map<string, () => void>();
  const embedListeners = new Map<string, (event: { target: unknown }) => void>();
  const documentListeners = new Map<string, (event: unknown) => void>();
  const messages: Array<{ data: unknown; origin: string }> = [];
  const frame = {
    tagName: 'iframe',
    contentWindow: { postMessage: (data: unknown, origin: string) => { messages.push({ data, origin }); } },
  };
  const section = { getAttribute: (name: string) => sectionAttributes.get(name) ?? null };
  const button = {
    disabled: false, hidden: false, textContent: '',
    addEventListener: (name: string, listener: () => void) => { buttonListeners.set(name, listener); },
  };
  const status = { textContent: '' };
  const fallback = { hidden: true };
  const embed = {
    replaceChildren: () => { embedChildren.length = 0; },
    appendChild: (child: typeof embedChildren[number]) => { embedChildren.push(child); },
    querySelector: (selector: string) => selector === 'iframe' ? embedChildren.find((child) => child.tagName === 'iframe') ?? null : null,
    addEventListener: (name: string, listener: (event: { target: unknown }) => void) => { embedListeners.set(name, listener); },
  };
  const nodes = new Map<string, unknown>([
    ['[data-article-comments]', section], ['[data-comment-load]', button],
    ['[data-comment-status]', status], ['[data-comment-fallback]', fallback],
    ['[data-comment-embed]', embed],
  ]);
  const document = {
    documentElement: root,
    querySelector: (selector: string) => nodes.get(selector) ?? null,
    addEventListener: (name: string, listener: (event: unknown) => void) => { documentListeners.set(name, listener); },
    dispatchEvent: (event: Event) => { documentListeners.get(event.type)?.(event); return true; },
    createElement: (tagName: string) => ({
      tagName, attributes: new Map<string, string>(),
      setAttribute(name: string, value: string) { this.attributes.set(name, value); },
      addEventListener() {},
    }),
    defaultView: { addEventListener() {} },
  } as unknown as Document;
  let systemDark = false;
  let mediaChange: (() => void) | undefined;
  const window = {
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ get matches() { return systemDark; }, addEventListener: (_: string, listener: () => void) => { mediaChange = listener; } }),
  } as unknown as Window;

  mountTheme(document, window);
  mountArticleComments(document);
  assert.equal(embedChildren.length, 0);
  buttonListeners.get('click')?.();
  assert.equal(embedChildren[0].attributes?.get('data-theme'), 'light');
  embedChildren.push(frame);
  embedListeners.get('load')?.({ target: frame });
  systemDark = true;
  mediaChange?.();
  assert.equal(root.getAttribute('data-theme'), 'dark');
  assert.deepEqual(messages, [{ data: { giscus: { setConfig: { theme: 'dark' } } }, origin: 'https://giscus.app' }]);
  assert.equal(embedChildren[1], frame);
});
