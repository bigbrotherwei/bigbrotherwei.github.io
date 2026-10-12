import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const diagramPath = new URL('../../public/interactive/distributed-filesystems.html', import.meta.url);

test('three filesystem articles embed their matching interactive diagrams', () => {
  for (const [slug, system] of [
    ['cephfs-architecture', 'cephfs'],
    ['juicefs-architecture', 'juicefs'],
    ['deepseek-3fs-architecture', '3fs'],
  ]) {
    const article = readFileSync(new URL(`../../src/content/posts/${slug}.md`, import.meta.url), 'utf8');
    assert.match(article, new RegExp(`<iframe src="/interactive/distributed-filesystems.html\\?system=${system}&embed=1"`));
    assert.match(article, /sandbox="allow-scripts"[^>]*data-auto-height/u);
  }
});

test('each diagram offers selectable paths and details for the selected step', () => {
  const source = readFileSync(diagramPath, 'utf8');
  for (const [system, title, path] of [
    ['cephfs', 'CephFS', 'MDS 接管'],
    ['juicefs', 'JuiceFS', 'Rename'],
    ['3fs', 'DeepSeek 3FS', 'CRAQ 写入'],
  ]) {
    const window = new JSDOM(source, {
      url: `https://example.com/interactive/distributed-filesystems.html?system=${system}&embed=1`,
      runScripts: 'dangerously',
      beforeParse(win) {
        win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver;
      },
    }).window;
    const document = window.document;
    assert.match(document.querySelector('h1')?.textContent ?? '', new RegExp(title));
    const pathButton = [...document.querySelectorAll<HTMLButtonElement>('[data-route]')]
      .find((button) => button.textContent?.includes(path));
    assert.ok(pathButton, `${system}: missing ${path} route`);
    pathButton.click();
    assert.equal(pathButton.getAttribute('aria-pressed'), 'true');
    const steps = [...document.querySelectorAll<HTMLButtonElement>('[data-step]')];
    assert.ok(steps.length >= 3, `${system}: route needs at least three steps`);
    steps.at(-1)!.click();
    assert.equal(steps.at(-1)!.getAttribute('aria-pressed'), 'true');
    assert.ok((document.querySelector('[data-step-detail]')?.textContent ?? '').length > 20);
    window.close();
  }
});
