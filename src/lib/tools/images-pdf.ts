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
