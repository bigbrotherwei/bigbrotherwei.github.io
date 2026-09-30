import { PDFDocument } from 'pdf-lib';
import type { ToolResult } from './result.ts';

const mib = 1024 * 1024;
const MAX_FILES = 20;
const MAX_FILE_BYTES = 20 * mib;
const MAX_TOTAL_BYTES = 100 * mib;
const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 24;

export interface NormalizedImage {
  name: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

export const validateImageFiles = (files: readonly File[]): ToolResult<File[]> => {
  if (files.length === 0) return { ok: false, error: '请先选择至少一张图片。' };
  if (files.length > MAX_FILES) return { ok: false, error: `最多只能选择 ${MAX_FILES} 张图片。` };
  const invalid = files.filter((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
  if (invalid.length) return { ok: false, error: `${invalid.map((file) => file.name).join('、')}：仅支持 JPEG、PNG、WebP。` };
  const empty = files.filter((file) => file.size === 0);
  if (empty.length) return { ok: false, error: `${empty.map((file) => file.name).join('、')}：文件为空或已损坏。` };
  const oversized = files.filter((file) => file.size > MAX_FILE_BYTES);
  if (oversized.length) return { ok: false, error: `${oversized.map((file) => file.name).join('、')}：单张不能超过 20 MiB。` };
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
    return { ok: false, error: '图片总大小不能超过 100 MiB。' };
  }
  return { ok: true, value: [...files] };
};

export const validateImageFileSignatures = async (files: readonly File[]): Promise<ToolResult<File[]>> => {
  const invalid: string[] = [];
  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
      const webp = bytes.length >= 12
        && [82, 73, 70, 70, 87, 69, 66, 80].every((byte, index) => bytes[index < 4 ? index : index + 4] === byte);
      if (!((file.type === 'image/jpeg' && jpeg) || (file.type === 'image/png' && png) || (file.type === 'image/webp' && webp))) {
        invalid.push(file.name);
      }
    } catch {
      invalid.push(file.name);
    }
  }
  return invalid.length
    ? { ok: false, error: `${invalid.join('、')}：图片签名与 JPEG、PNG、WebP 类型不符或文件已损坏。` }
    : { ok: true, value: [...files] };
};

export const normalizeImage = async (
  file: File,
  decode: typeof createImageBitmap = createImageBitmap,
  makeCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): Promise<NormalizedImage> => {
  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`${file.name}：图片无法解码或已损坏`);
  }
  let canvas: HTMLCanvasElement | undefined;
  try {
    const { width, height } = bitmap;
    if (width <= 0 || height <= 0 || width * height > 30_000_000) throw new Error('像素超过 30 MP 或尺寸无效');
    const landscape = width > height;
    const scale = Math.min(1, (landscape ? 2339 : 1654) / width, (landscape ? 1654 : 2339) / height);
    canvas = makeCanvas();
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法创建画布');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas!.toBlob(
      (result) => result ? resolve(result) : reject(new Error('JPEG 编码失败')), 'image/jpeg', 0.88,
    ));
    return { name: file.name, bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
  } catch (error) {
    throw new Error(`${file.name}：${error instanceof Error ? error.message : '图片处理失败'}`);
  } finally {
    bitmap.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
};

export const restoreQueueFocus = (
  list: HTMLElement, index: number, action: 'up' | 'down' | 'remove', fallback: HTMLElement,
) => {
  const row = list.children[index];
  const buttons = row ? Array.from(row.querySelectorAll<HTMLButtonElement>('button')) : [];
  const preferred = buttons.find((button) => !button.disabled
    && (button.dataset.move === action || (action === 'remove' && 'remove' in button.dataset)));
  (preferred ?? buttons.find((button) => !button.disabled) ?? fallback).focus();
};

export const placeImage = (width: number, height: number, pageWidth: number, pageHeight: number, margin: number) => {
  if (![width, height, pageWidth, pageHeight, margin].every(Number.isFinite)
    || width <= 0 || height <= 0 || margin < 0 || pageWidth <= 2 * margin || pageHeight <= 2 * margin) {
    throw new RangeError('图片或页面尺寸无效');
  }
  const scale = Math.min((pageWidth - 2 * margin) / width, (pageHeight - 2 * margin) / height);
  const placedWidth = width * scale;
  const placedHeight = height * scale;
  return { x: (pageWidth - placedWidth) / 2, y: (pageHeight - placedHeight) / 2, width: placedWidth, height: placedHeight };
};

export const buildImagesPdf = async (images: readonly NormalizedImage[]): Promise<Uint8Array> => {
  if (images.length === 0 || images.length > MAX_FILES) throw new Error(`PDF 需要 1 至 ${MAX_FILES} 张图片。`);
  const pdf = await PDFDocument.create();
  for (const image of images) {
    try {
      if (!Number.isFinite(image.width * image.height) || image.width <= 0 || image.height <= 0 || image.width * image.height > 30_000_000) {
        throw new Error('图片尺寸无效或超过 30 MP');
      }
      const landscape = image.width > image.height;
      const pageWidth = landscape ? A4.height : A4.width;
      const pageHeight = landscape ? A4.width : A4.height;
      const embedded = await pdf.embedJpg(image.bytes);
      const page = pdf.addPage([pageWidth, pageHeight]);
      page.drawImage(embedded, placeImage(image.width, image.height, pageWidth, pageHeight, MARGIN));
    } catch (error) {
      throw new Error(`${image.name}：${error instanceof Error ? error.message : '无法写入 PDF'}`);
    }
  }
  return pdf.save();
};
