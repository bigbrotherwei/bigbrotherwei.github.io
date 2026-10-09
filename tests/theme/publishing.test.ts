import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

const root = new URL('../../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');
const css = postcss.parse(source('src/styles/global.css'));
const toolsCss = postcss.parse(source('src/styles/tools.css'));
const catalogCss = postcss.parse(source('src/pages/tools/index.astro').split('<style>')[1].split('</style>')[0]);
const homeCss = postcss.parse(source('src/pages/index.astro').split('<style>')[1].split('</style>')[0]);
const aboutCss = postcss.parse(source('src/pages/about.astro').split('<style>')[1].split('</style>')[0]);

function declarations(sheet: postcss.Root, selector: string) {
  const rule = sheet.nodes.find((node) => node.type === 'rule' && (node.selector === selector || node.selector.split(/,\s*(?![^()]*\))/).map((item) => item.trim()).includes(selector)));
  assert.ok(rule && rule.type === 'rule', `missing ${selector}`);
  return Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]));
}

function contrast(foreground: string, background: string) {
  const luminance = (hex: string) => {
    assert.match(hex, /^#[0-9a-f]{6}$/i);
    const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
    return channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('published entry points load theme styles and keep the navigation control', () => {
  const assets = readdirSync(new URL('dist/_astro/', root)).filter((name) => name.endsWith('.css'));
  for (const path of [
    'index.html', 'posts/index.html', 'posts/blog-rebuild-roadmap/index.html',
    'topics/index.html', 'topics/blog-rebuild/index.html', 'search/index.html', 'tools/index.html',
    ...['json', 'base64', 'url', 'timestamp', 'uuid', 'text-counter'].map((name) => `tools/${name}/index.html`),
  ]) {
    const html = source(`dist/${path}`);
    assert.match(html, /data-theme-prepaint/);
    assert.match(html, /data-theme-toggle/);
    const linked = assets.filter((name) => html.includes(`/_astro/${name}`));
    assert.ok(linked.some((name) => source(`dist/_astro/${name}`).includes('--color-reading-surface')), `${path} must load themed CSS`);
  }
});

test('both themes define readable surfaces and control colors', () => {
  for (const theme of [':root', ':root[data-theme="dark"]']) {
    const tokens = declarations(css, theme);
    for (const name of ['--color-reading-surface', '--color-text', '--color-muted', '--color-line', '--color-input', '--color-accent', '--color-success', '--color-error', '--color-code', '--color-focus', '--color-action', '--color-action-text']) {
      assert.ok(tokens[name], `${theme} missing ${name}`);
    }
    assert.ok(contrast(tokens['--color-text'], tokens['--color-reading-surface']) >= 4.5, `${theme} body contrast`);
    assert.ok(contrast(tokens['--color-muted'], tokens['--color-reading-surface']) >= 4.5, `${theme} secondary contrast`);
    assert.ok(contrast(tokens['--color-action-text'], tokens['--color-action']) >= 4.5, `${theme} action contrast`);
  }
  assert.equal(declarations(css, ':root')['--color-scene-text'], '#fffaf1');
  assert.equal(declarations(css, ':root[data-theme="dark"]')['--color-scene-text'], undefined);
});

test('dark reading surfaces are neutral charcoal and light surfaces stay unchanged', () => {
  const dark = declarations(css, ':root[data-theme="dark"]');
  for (const name of ['--color-reading-surface', '--color-panel', '--color-panel-soft', '--color-input', '--color-code']) {
    const value = dark[name];
    assert.match(value, /^#[0-9a-f]{6}$/i, `${name} must be a solid color`);
    const [red, green, blue] = [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
    assert.ok(Math.max(red, green, blue) - Math.min(red, green, blue) <= 12, `${name} should be neutral, got ${value}`);
  }
  assert.deepEqual(
    ['--color-reading-surface', '--color-panel', '--color-panel-soft', '--color-input'].map((name) => declarations(css, ':root')[name]),
    ['#f7f3ea', '#fffaf1', '#ece8dd', '#ffffff'],
  );
});

test('dark reading text and controls meet contrast on their actual surfaces', () => {
  const dark = declarations(css, ':root[data-theme="dark"]');
  for (const surface of ['--color-reading-surface', '--color-panel', '--color-panel-soft', '--color-input', '--color-code']) {
    assert.ok(contrast(dark['--color-text'], dark[surface]) >= 4.5, `body text on ${surface}`);
    assert.ok(contrast(dark['--color-muted'], dark[surface]) >= 4.5, `secondary text on ${surface}`);
  }
  for (const surface of ['--color-reading-surface', '--color-panel', '--color-panel-soft']) {
    assert.ok(contrast(dark['--color-accent'], dark[surface]) >= 4.5, `links on ${surface}`);
  }
  for (const surface of ['--color-action', '--color-action-hover']) {
    assert.ok(contrast(dark['--color-action-text'], dark[surface]) >= 4.5, `button text on ${surface}`);
  }
  for (const surface of ['--color-panel', '--color-code', '--color-input', '--color-action']) {
    assert.ok(contrast(dark['--color-focus'], dark[surface]) >= 3, `focus ring on ${surface}`);
  }
});

test('dark filled controls have a visible boundary against panels', () => {
  const dark = declarations(css, ':root[data-theme="dark"]');
  const boundary = dark['--color-action-border'] ?? dark['--color-action'];
  assert.ok(contrast(boundary, dark['--color-panel']) >= 3, 'filled control boundary on panel');
  assert.ok(contrast(boundary, dark['--color-panel-soft']) >= 3, 'filled control boundary on soft panel');
  assert.equal(declarations(toolsCss, '.tool-toolbar button').border, '1px solid var(--color-action-border)');
  assert.equal(declarations(toolsCss, ".tool-segmented button[aria-pressed='true']")['border-color'], 'var(--color-action-border)');
  assert.equal(declarations(catalogCss, ".tool-tags button[aria-pressed='true']")['border-color'], 'var(--color-action-border)');
  assert.equal(declarations(css, '.article-comments__load').border, '1px solid var(--color-action-border)');
});

test('reading and tool surfaces consume semantic theme tokens', () => {
  for (const selector of ['.sketch-card', '.article-toc', '.tag-index__item', '.article-adjacent__link', '.search-panel', '.search-result', '.site-stats', '.article-reads', '.article-comments']) {
    assert.match(JSON.stringify(declarations(css, selector)), /var\(--color-/);
  }
  for (const selector of ['.tool-workspace', '.tool-field :where(input, select, textarea)', '.tool-segmented button', '.tool-toolbar button', '.tool-status', '.tool-results :where(.tool-result-value, pre)']) {
    assert.match(JSON.stringify(declarations(toolsCss, selector)), /var\(--color-/);
  }
  for (const selector of ['.tool-panel', 'input', '.tool-tags button']) {
    assert.match(JSON.stringify(declarations(catalogCss, selector)), /var\(--color-/);
  }
  assert.match(declarations(css, '.page-hero h1').color, /--color-scene-text/);
});

test('home card text uses the reading theme while article metadata stays legible over the scene', () => {
  assert.equal(declarations(homeCss, '.home-card h3').color, 'var(--color-text)');
  assert.equal(declarations(homeCss, '.home-card span').color, 'var(--color-accent)');
  assert.equal(declarations(css, '.article-header .content-card__meta').color, 'var(--color-scene-link)');
});

test('about page links follow the reading theme', () => {
  assert.equal(declarations(aboutCss, '.about-links a').color, 'var(--color-accent)');
});

test('night-scene section eyebrows use scene text while surface eyebrows keep reading accents', () => {
  assert.equal(declarations(css, '.section-heading--compact .eyebrow').color, 'var(--color-scene-link)');
  assert.equal(declarations(css, '.privacy-page header .eyebrow').color, 'var(--color-scene-link)');
  assert.equal(declarations(css, '.article-comments .section-heading--compact .eyebrow').color, 'var(--color-accent)');
  assert.equal(declarations(css, '.eyebrow').color, 'var(--color-accent)');
  assert.ok(contrast(declarations(css, ':root')['--color-scene-link'], '#0b1629') >= 4.5);
});

test('scene links have a visible focus ring in light and dark mode', () => {
  assert.equal(declarations(css, '.site-nav a:focus-visible').outline, '3px solid var(--color-scene-focus)');
  assert.equal(declarations(css, '.back-link:focus-visible').outline, '3px solid var(--color-scene-focus)');
  assert.ok(contrast(declarations(css, ':root')['--color-scene-focus'], '#0b1629') >= 3);
  assert.equal(declarations(css, ':root[data-theme="dark"]')['--color-scene-focus'], undefined);
});

test('theme menu focus ring contrasts with both menu backgrounds', () => {
  assert.equal(declarations(css, '.site-nav__theme-menu button:focus-visible').outline, '3px solid var(--color-focus)');
  for (const theme of [':root', ':root[data-theme="dark"]']) {
    const tokens = declarations(css, theme);
    assert.ok(contrast(tokens['--color-focus'], tokens['--color-panel']) >= 3, `${theme} menu panel focus contrast`);
    assert.ok(contrast(tokens['--color-focus'], tokens['--color-code']) >= 3, `${theme} selected option focus contrast`);
  }
});

test('card metadata hover stays readable on both reading panels', () => {
  assert.equal(declarations(css, '.content-card__meta a:hover').color, 'var(--color-meta-hover)');
  assert.equal(declarations(css, '.article-header .content-card__meta a:hover').color, 'var(--color-scene-text)');
  for (const theme of [':root', ':root[data-theme="dark"]']) {
    const tokens = declarations(css, theme);
    assert.ok(contrast(tokens['--color-meta-hover'], tokens['--color-panel']) >= 4.5, `${theme} metadata hover contrast`);
  }
});
