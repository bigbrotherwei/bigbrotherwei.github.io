import type { ToolResult } from './result.ts';

export const validateQrText = (text: string): ToolResult<string> => {
  if (text.trim() === '') return { ok: false, error: '请输入要生成二维码的内容' };
  if (new TextEncoder().encode(text).length > 1000) {
    return { ok: false, error: '内容不能超过 1000 个 UTF-8 字节' };
  }
  return { ok: true, value: text };
};

type QrElements = {
  text: HTMLTextAreaElement;
  size: HTMLSelectElement;
  level: HTMLSelectElement;
  canvas: HTMLCanvasElement;
  download: HTMLAnchorElement;
  status: HTMLElement;
};

type QrLevel = 'L' | 'M' | 'Q' | 'H';
type RenderQr = (text: string, canvas: HTMLCanvasElement, options: { width: number; errorCorrectionLevel: QrLevel }) => Promise<string>;

export const createQrController = (elements: QrElements, render: RenderQr) => {
  let generation = 0;
  const clear = () => {
    generation += 1;
    elements.canvas.hidden = true;
    elements.canvas.width = 0;
    elements.canvas.height = 0;
    elements.download.hidden = true;
    elements.download.removeAttribute('href');
  };
  const status = (message: string, state: 'idle' | 'success' | 'error') => {
    elements.status.textContent = message;
    if (state === 'idle') delete elements.status.dataset.state;
    else elements.status.dataset.state = state;
  };
  const generate = async () => {
    clear();
    const current = generation;
    const result = validateQrText(elements.text.value);
    if (!result.ok) {
      status(result.error, 'error');
      return;
    }
    const width = Number(elements.size.value);
    const level = elements.level.value;
    if (![256, 512, 1024].includes(width) || !['L', 'M', 'Q', 'H'].includes(level)) {
      status('请选择有效的尺寸和纠错级别', 'error');
      return;
    }
    status('正在生成二维码…', 'idle');
    try {
      const png = await render(result.value, elements.canvas, { width, errorCorrectionLevel: level as QrLevel });
      if (current !== generation) return;
      elements.download.href = png;
      elements.canvas.hidden = false;
      elements.download.hidden = false;
      status('二维码已生成，可下载 PNG', 'success');
    } catch {
      if (current !== generation) return;
      clear();
      status('二维码无法生成，请缩短内容或降低纠错级别', 'error');
    }
  };
  return { clear, generate, status };
};
