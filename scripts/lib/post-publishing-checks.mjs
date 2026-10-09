import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { parse as parseYaml } from 'yaml';

const parser = unified().use(remarkParse).use(remarkMdx);
const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const postSlug = (file) => file.replace(/^.*?src\/content\/posts\//, '').replace(/\.mdx?$/, '');

export const parsePostSource = (file, source) => {
  const match = source.match(frontmatterPattern);
  if (!match) throw new Error(`${file}: 缺少 YAML frontmatter`);
  const data = parseYaml(match[1]);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${file}: YAML frontmatter 必须是字段对象`);
  }
  return {
    data,
    body: source.slice(match[0].length),
    bodyStartLine: match[0].split(/\r?\n/).length,
  };
};

export const checkPostPublishing = ({ posts, topics, publicRoot }) => {
  const diagnostics = [];
  const slugs = new Map();
  const orders = new Map();
  const issue = (file, message, line) => diagnostics.push({ file, message: line ? `第 ${line} 行：${message}` : message });

  for (const { file, source } of posts) {
    let parsed;
    try {
      parsed = parsePostSource(file, source);
    } catch (error) {
      issue(file, `YAML frontmatter 解析失败：${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const { data, body, bodyStartLine } = parsed;
    const slug = postSlug(file);
    const previousSlug = slugs.get(slug);
    if (previousSlug) issue(file, `文章 slug 冲突：${previousSlug} 与 ${file}`);
    else slugs.set(slug, file);

    if (!topics.has(data.topic)) issue(file, `专题不存在：${String(data.topic ?? '')}（topic）`);
    if (typeof data.topic === 'string' && Number.isInteger(data.order)) {
      const key = `${data.topic}\0${data.order}`;
      const previousOrder = orders.get(key);
      if (previousOrder) issue(file, `专题 ${data.topic} 的 order ${data.order} 与 ${previousOrder} 冲突`);
      else orders.set(key, file);
    }

    const checkPath = (url, kind, line) => {
      if (!url || url.startsWith('#') || url.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(url)) return;
      if (!url.startsWith('/')) {
        if (kind !== 'link') issue(file, `${kind}请使用站点根路径：${url}`, line);
        return;
      }
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(url, 'https://blog.invalid').pathname);
      } catch {
        issue(file, `无效的站内路径：${url}`, line);
        return;
      }
      if (kind === 'link' && !/\.[a-z\d]+$/i.test(pathname)) return;
      const absolute = resolve(publicRoot, `.${pathname}`);
      if (relative(publicRoot, absolute).startsWith('..') || !existsSync(absolute)) {
        issue(file, `${kind}资源不存在：${url}`, line);
      }
    };

    const checkImage = (src, alt, line) => {
      if (!alt?.trim()) issue(file, '图片缺少替代文本（alt）', line);
      checkPath(src, '图片', line);
    };

    let tree;
    try {
      tree = parser.parse(body);
    } catch (error) {
      issue(file, `正文解析失败：${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    visit(tree, (node) => {
      const line = node.position ? bodyStartLine + node.position.start.line - 1 : undefined;
      if (node.type === 'image') checkImage(node.url, node.alt, line);
      if (node.type === 'link') checkPath(node.url, 'link', line);
      if (node.type === 'html') {
        const fragment = JSDOM.fragment(node.value);
        for (const image of fragment.querySelectorAll('img')) checkImage(image.getAttribute('src'), image.getAttribute('alt'), line);
        for (const media of fragment.querySelectorAll('video[src], source[src]')) checkPath(media.getAttribute('src'), '媒体', line);
      }
      if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
        const attributes = new Map(node.attributes
          .filter((attribute) => attribute.type === 'mdxJsxAttribute')
          .map((attribute) => [attribute.name, typeof attribute.value === 'string' ? attribute.value : null]));
        if (node.name === 'img') checkImage(attributes.get('src'), attributes.get('alt'), line);
        if (node.name === 'video' || node.name === 'source') checkPath(attributes.get('src'), '媒体', line);
      }
    });
  }

  return diagnostics.sort((left, right) => left.file.localeCompare(right.file) || left.message.localeCompare(right.message));
};
