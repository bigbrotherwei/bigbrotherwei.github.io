import { diffLines, diffWordsWithSpace } from 'diff';
import type { ToolResult } from './result.ts';
import type { DiffChunk, DiffMode } from './text-diff.ts';

const maxLength = 100_000;

export const compareText = (
  oldText: string,
  newText: string,
  mode: DiffMode,
  timeoutMs = 1000,
): ToolResult<DiffChunk[]> => {
  if (oldText.length > maxLength || newText.length > maxLength) {
    return { ok: false, error: '每份文本最多 100,000 个字符，请缩短后重试' };
  }

  const changes = mode === 'line'
    ? diffLines(oldText, newText, { timeout: timeoutMs })
    : diffWordsWithSpace(oldText, newText, { timeout: timeoutMs });
  if (!changes) return { ok: false, error: '差异计算超时，请缩短文本后重试' };
  return {
    ok: true,
    value: changes.map(({ value, added, removed }) => ({
      value,
      kind: added ? 'add' : removed ? 'remove' : 'same',
    })),
  };
};
