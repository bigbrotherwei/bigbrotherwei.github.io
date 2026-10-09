import createDOMPurify from 'dompurify';
import { marked } from 'marked';
import type { ToolResult } from './result.ts';

const MAX_BYTES = 1024 * 1024;
const sizeError = 'Markdown 内容不能超过 1 MiB。';
const markdownTags = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
  'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'pre', 'code', 'strong', 'em', 'del', 'a', 'img',
];
const markdownAttributes = ['href', 'src', 'alt', 'title', 'start', 'align'];

export const renderMarkdown = (markdown: string, window: Window): ToolResult<string> => {
  if (new TextEncoder().encode(markdown).byteLength > MAX_BYTES) return { ok: false, error: sizeError };

  try {
    const parsed = marked.parse(markdown, { async: false, gfm: true, breaks: false });
    const purifier = createDOMPurify(window as unknown as Parameters<typeof createDOMPurify>[0]);
    const clean = purifier.sanitize(parsed, {
      ALLOWED_TAGS: markdownTags,
      ALLOWED_ATTR: markdownAttributes,
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: false,
    });
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

interface MarkdownPreviewElements {
  input: HTMLTextAreaElement;
  preview: HTMLElement;
  status: HTMLElement;
  window: Window;
}

export const createMarkdownPreviewController = ({ input, preview, status, window }: MarkdownPreviewElements) => {
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const showStatus = (message: string, state: 'success' | 'error' | 'idle' = 'idle') => {
    status.textContent = message;
    if (state === 'idle') delete status.dataset.state;
    else status.dataset.state = state;
  };

  const updatePreview = () => {
    const result = renderMarkdown(input.value, window);
    if (!result.ok) {
      preview.replaceChildren();
      showStatus(result.error, 'error');
      return;
    }
    preview.innerHTML = result.value;
    showStatus('预览已更新', 'success');
  };

  const schedulePreview = () => {
    generation += 1;
    clearTimeout(timer);
    showStatus('正在更新预览…');
    timer = setTimeout(updatePreview, 200);
  };

  const importFile = async (file: MarkdownFile) => {
    const request = ++generation;
    clearTimeout(timer);
    showStatus(`正在读取 ${file.name}…`);
    const result = await importMarkdownFile(file);
    if (request !== generation) return;
    if (!result.ok) {
      showStatus(result.error, 'error');
      return;
    }
    input.value = result.value;
    updatePreview();
    input.focus();
  };

  const clear = () => {
    generation += 1;
    clearTimeout(timer);
    input.value = '';
    updatePreview();
    input.focus();
  };

  return { updatePreview, schedulePreview, importFile, clear };
};
