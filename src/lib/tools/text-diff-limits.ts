import type { ToolResult } from './result.ts';

const maxLength = 100_000;

export const validateDiffLength = (oldText: string, newText: string): ToolResult<true> =>
  oldText.length > maxLength || newText.length > maxLength
    ? { ok: false, error: '每份文本最多 100,000 个字符，请缩短后重试' }
    : { ok: true, value: true };
