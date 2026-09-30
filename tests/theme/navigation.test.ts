import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from '@astrojs/compiler';
import postcss from 'postcss';
import { mountTheme } from '../../src/scripts/theme.ts';

type Node = { type: string; name?: string; attributes?: Array<{ name: string; value: string }>; children?: Node[] };
const attr = (node: Node, name: string) => node.attributes?.find((item) => item.name === name)?.value;
function descendants(node: Node, predicate: (node: Node) => boolean): Node[] {
  return [node, ...(node.children ?? []).flatMap((child) => descendants(child, predicate))].filter(predicate);
}

test('navigation declares an accessible three-choice theme menu beside search', async () => {
  const source = readFileSync(new URL('../../src/components/SiteNav.astro', import.meta.url), 'utf8');
  const { ast } = await parse(source);
  const nodes = descendants(ast as Node, (node) => node.type === 'element');
  const toggle = nodes.find((node) => attr(node, 'data-theme-toggle') !== undefined);
  const menu = nodes.find((node) => attr(node, 'data-theme-menu') !== undefined);
  assert.ok(toggle);
  assert.ok(menu);
  assert.equal(toggle.name, 'button');
  assert.equal(attr(toggle, 'aria-controls'), attr(menu, 'id'));
  assert.equal(attr(toggle, 'aria-expanded'), 'false');
  assert.ok(attr(toggle, 'aria-label'));
  assert.deepEqual(descendants(menu, (node) => attr(node, 'data-theme-choice') !== undefined).map((node) => [
    attr(node, 'data-theme-choice'), attr(node, 'role'), attr(node, 'aria-checked'), node.name,
  ]), [
    ['system', 'menuitemradio', 'true', 'button'],
    ['light', 'menuitemradio', 'false', 'button'],
    ['dark', 'menuitemradio', 'false', 'button'],
  ]);
  assert.ok(nodes.some((node) => attr(node, 'aria-label') === '搜索'));
});

type Listener = (event: any) => void;
class Element {
  value: string | undefined;
  attributes = new Map<string, string>();
  listeners = new Map<string, Listener>();
  hidden = false;
  focused = false;
  focusCount = 0;
  parent?: Element;
  constructor(value?: string) { this.value = value; }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  addEventListener(name: string, listener: Listener) { this.listeners.set(name, listener); }
  fire(name: string, event: any = {}) { this.listeners.get(name)?.({ target: this, ...event }); }
  focus() { this.focused = true; this.focusCount += 1; }
  contains(target: Element) { return target === this || target.parent === this; }
}

function fixture(preference = 'system', dark = false) {
  const root = new Element();
  root.setAttribute('data-theme-preference', preference);
  const toggle = new Element();
  const menu = new Element();
  menu.hidden = true;
  const choices = ['system', 'light', 'dark'].map((value) => {
    const choice = new Element(value);
    choice.setAttribute('data-theme-choice', value);
    choice.parent = menu;
    return choice;
  });
  const documentListeners = new Map<string, Listener>();
  const document = {
    documentElement: root,
    querySelector: (selector: string) => ({ '[data-theme-toggle]': toggle, '[data-theme-menu]': menu }[selector] ?? null),
    querySelectorAll: (selector: string) => selector === '[data-theme-choice]' ? choices : [],
    addEventListener: (name: string, listener: Listener) => { documentListeners.set(name, listener); },
    dispatchEvent: (event: { type: string }) => { documentListeners.get(event.type)?.(event); return true; },
    fire: (name: string, event: any) => documentListeners.get(name)?.({ preventDefault: () => {}, ...event }),
  };
  const storage = new Map<string, string>();
  const window = { localStorage: {
    getItem: () => null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  }, matchMedia: () => ({ matches: dark, addEventListener: () => {} }) };
  mountTheme(document as unknown as Document, window as unknown as Window);
  return { root, toggle, menu, choices, document, storage };
}

test('opening the menu focuses its selected option and Escape returns focus', () => {
  const app = fixture('dark');
  assert.equal(app.choices[2].getAttribute('aria-checked'), 'true');
  app.toggle.fire('click');
  assert.equal(app.toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(app.menu.hidden, false);
  assert.equal(app.choices[2].focused, true);
  app.document.fire('keydown', { key: 'Escape' });
  assert.equal(app.menu.hidden, true);
  assert.equal(app.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(app.toggle.focused, true);
});

test('selection updates checked preference even when effective appearance stays light', () => {
  const app = fixture('system');
  app.toggle.fire('click');
  app.choices[1].fire('click');
  assert.equal(app.root.getAttribute('data-theme'), 'light');
  assert.equal(app.root.getAttribute('data-theme-preference'), 'light');
  assert.equal(app.storage.get('blog-theme-preference'), 'light');
  assert.deepEqual(app.choices.map((choice) => choice.getAttribute('aria-checked')), ['false', 'true', 'false']);
  assert.equal(app.menu.hidden, true);
});

test('outside click closes menu while a click on a choice stays inside', () => {
  const app = fixture();
  app.toggle.fire('click');
  app.document.fire('click', { target: app.choices[0] });
  assert.equal(app.menu.hidden, false);
  app.document.fire('click', { target: new Element() });
  assert.equal(app.menu.hidden, true);
});

test('arrow keys wrap through choices, and Home and End focus the boundaries', () => {
  const app = fixture('dark');
  app.toggle.fire('click');
  let prevented = 0;
  const press = (key: string, target: Element) => app.document.fire('keydown', {
    key, target, preventDefault: () => { prevented += 1; },
  });
  press('ArrowDown', app.choices[2]);
  assert.equal(app.choices[0].focusCount, 1);
  press('ArrowUp', app.choices[0]);
  assert.equal(app.choices[2].focusCount, 2);
  press('Home', app.choices[2]);
  assert.equal(app.choices[0].focusCount, 2);
  press('End', app.choices[0]);
  assert.equal(app.choices[2].focusCount, 3);
  assert.equal(prevented, 4);
  assert.equal(app.menu.hidden, false);
});

test('Tab and focus leaving the control close the menu without stealing focus', () => {
  const app = fixture();
  app.toggle.fire('click');
  let prevented = false;
  app.document.fire('keydown', { key: 'Tab', target: app.choices[0], preventDefault: () => { prevented = true; } });
  assert.equal(app.menu.hidden, true);
  assert.equal(prevented, false);
  assert.equal(app.toggle.focused, false);

  app.toggle.fire('click');
  app.document.fire('focusin', { target: new Element() });
  assert.equal(app.menu.hidden, true);
  assert.equal(app.toggle.getAttribute('aria-expanded'), 'false');
});

test('Escape prevents default and returns focus to the trigger from any choice', () => {
  const app = fixture();
  app.toggle.fire('click');
  let prevented = false;
  app.document.fire('keydown', { key: 'Escape', target: app.choices[1], preventDefault: () => { prevented = true; } });
  assert.equal(app.menu.hidden, true);
  assert.equal(app.toggle.focused, true);
  assert.equal(prevented, true);
});

test('narrow navigation positions the menu within the viewport rather than its wrapped button', () => {
  const css = postcss.parse(readFileSync(new URL('../../src/styles/global.css', import.meta.url), 'utf8'));
  const mobile = css.nodes.find((node) => node.type === 'atrule' && node.name === 'media' && node.params === '(max-width: 760px)');
  assert.ok(mobile && mobile.type === 'atrule');
  const declarations = (selector: string) => {
    const rule = mobile.nodes?.find((node) => node.type === 'rule' && node.selector === selector);
    assert.ok(rule && rule.type === 'rule', `${selector} has a mobile rule`);
    return Object.fromEntries(rule.nodes?.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]) ?? []);
  };
  assert.equal(declarations('.site-nav__theme').position, 'static');
  assert.equal(declarations('.site-nav__theme-menu').right, '1rem');
  assert.equal(declarations('.site-nav__theme-menu').width, 'min(10.5rem, calc(100vw - 2rem))');
});
