import assert from 'node:assert/strict';
import test from 'node:test';
import { mountArticleComments } from '../../src/scripts/article-comments.ts';

type Listener = () => void;

class ElementStub {
  tagName: string;
  hidden = false;
  disabled = false;
  textContent = '';
  src = '';
  async = false;
  crossOrigin = '';
  children: ElementStub[] = [];
  attributes = new Map<string, string>();
  listeners = new Map<string, Listener>();

  constructor(tagName: string) { this.tagName = tagName; }

  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  addEventListener(name: string, listener: Listener): void { this.listeners.set(name, listener); }
  appendChild(child: ElementStub): void { this.children.push(child); }
  remove(): void { /* Replaced by the parent in the test fixture below. */ }
  dispatch(name: string): void { this.listeners.get(name)?.(); }
}

function fixture(configured = true) {
  const section = new ElementStub('section');
  const button = new ElementStub('button');
  const status = new ElementStub('p');
  const fallback = new ElementStub('a');
  const embed = new ElementStub('div');
  if (configured) {
    for (const [key, value] of Object.entries({
      'data-repo': 'bigbrotherwei/bigbrotherwei.github.io',
      'data-repo-id': 'R_kgDOExample',
      'data-category': 'Comments',
      'data-category-id': 'DIC_kwDOExample',
      'data-mapping': 'pathname',
      'data-strict': '1',
      'data-lang': 'zh-CN',
    })) section.setAttribute(key, value);
  } else {
    button.hidden = true;
    status.textContent = '评论未开放';
  }
  fallback.hidden = true;
  fallback.setAttribute('href', 'https://github.com/bigbrotherwei/bigbrotherwei.github.io/discussions');
  embed.appendChild = (child) => { embed.children.push(child); child.remove = () => { embed.children = embed.children.filter((item) => item !== child); }; };
  const nodes = new Map([
    ['[data-article-comments]', section],
    ['[data-comment-load]', button],
    ['[data-comment-status]', status],
    ['[data-comment-fallback]', fallback],
    ['[data-comment-embed]', embed],
  ]);
  const document = {
    querySelector: (selector: string) => nodes.get(selector) ?? null,
    createElement: (tagName: string) => new ElementStub(tagName),
  } as unknown as Document;
  return { document, button, status, fallback, embed };
}

test('script is absent until click, then configured once for article pathname mapping', () => {
  const { document, button, status, embed } = fixture();
  mountArticleComments(document);
  assert.equal(embed.children.length, 0);

  button.dispatch('click');
  assert.equal(embed.children.length, 1);
  const script = embed.children[0];
  assert.equal(script.src, 'https://giscus.app/client.js');
  assert.equal(script.crossOrigin, 'anonymous');
  assert.equal(script.async, true);
  assert.deepEqual(Object.fromEntries(script.attributes), {
    'data-repo': 'bigbrotherwei/bigbrotherwei.github.io',
    'data-repo-id': 'R_kgDOExample',
    'data-category': 'Comments',
    'data-category-id': 'DIC_kwDOExample',
    'data-mapping': 'pathname',
    'data-strict': '1',
    'data-lang': 'zh-CN',
  });
  assert.equal(status.textContent, '评论加载中…');
  button.dispatch('click');
  assert.equal(embed.children.length, 1);
});

test('script error restores retry and shows Discussions fallback', () => {
  const { document, button, status, fallback, embed } = fixture();
  mountArticleComments(document);
  button.dispatch('click');
  embed.children[0].dispatch('error');
  assert.equal(status.textContent, '评论加载失败，请重试或前往 GitHub Discussions。');
  assert.equal(button.disabled, false);
  assert.equal(button.hidden, false);
  assert.equal(fallback.hidden, false);
  assert.equal(fallback.getAttribute('href'), 'https://github.com/bigbrotherwei/bigbrotherwei.github.io/discussions');
  button.dispatch('click');
  assert.equal(embed.children.length, 1);
});

test('unconfigured comments stay unavailable without inserting a script', () => {
  const { document, button, status, embed } = fixture(false);
  mountArticleComments(document);
  button.dispatch('click');
  assert.equal(button.hidden, true);
  assert.equal(status.textContent, '评论未开放');
  assert.equal(embed.children.length, 0);
});
