import createDOMPurify from 'dompurify';
import { marked } from 'marked';
import type { ToolResult } from './result.ts';

const MAX_BYTES = 1024 * 1024;
const sizeError = 'Markdown 内容不能超过 1 MiB。';

export const renderMarkdown = (markdown: string, window: Window): ToolResult<string> => {
  if (new TextEncoder().encode(markdown).byteLength > MAX_BYTES) return { ok: false, error: sizeError };

  try {
    const parsed = marked.parse(markdown, { async: false, gfm: true, breaks: false });
    const purifier = createDOMPurify(window as unknown as Parameters<typeof createDOMPurify>[0]);
    const clean = purifier.sanitize(parsed);
    const container = window.document.createElement('div');
    container.innerHTML = clean;

    for (const anchor of container.querySelectorAll('a[href]')) {
      const href = anchor.getAttribute('href') ?? '';
      if (/^(?:https?:)?\/\//i.test(href)) {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
      }
    }

    return { ok: true, value: container.innerHTML };
  } catch (error) {
    return { ok: false, error: `Markdown 解析失败：${error instanceof Error ? error.message : '未知错误'}` };
  }
};

export interface MarkdownFile {
  name: string;
  size: number;
  text(): Promise<string>;
}

export const importMarkdownFile = async (file: MarkdownFile): Promise<ToolResult<string>> => {
  if (!/\.md$/i.test(file.name)) return { ok: false, error: '请选择 .md 文件。' };
  if (file.size > MAX_BYTES) return { ok: false, error: `${file.name} 超过 1 MiB，原内容已保留。` };
  try {
    const content = await file.text();
    if (new TextEncoder().encode(content).byteLength > MAX_BYTES) {
      return { ok: false, error: `${file.name} 超过 1 MiB，原内容已保留。` };
    }
    return { ok: true, value: content };
  } catch (error) {
    return { ok: false, error: `${file.name} 读取失败：${error instanceof Error ? error.message : '未知错误'}。原内容已保留。` };
  }
};
