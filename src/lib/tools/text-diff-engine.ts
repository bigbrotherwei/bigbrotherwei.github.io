import { diffLines, diffWordsWithSpace } from 'diff';
import type { ToolResult } from './result.ts';
import type { DiffChunk, DiffMode } from './text-diff.ts';
import { validateDiffLength } from './text-diff-limits.ts';

export const compareText = (
  oldText: string,
  newText: string,
  mode: DiffMode,
  timeoutMs = 1000,
): ToolResult<DiffChunk[]> => {
  const length = validateDiffLength(oldText, newText);
  if (!length.ok) return length;

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
