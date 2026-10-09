import { diffLines, diffWordsWithSpace } from 'diff';
import type { ToolResult } from './result.ts';

export type DiffChunk = { value: string; kind: 'same' | 'add' | 'remove' };
export type DiffMode = 'line' | 'word';

const maxLength = 100_000;
const labels: Record<DiffChunk['kind'], string> = {
  same: '未变',
  add: '新增',
  remove: '删除',
};

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

export const swapDiffInputs = (oldText: string, newText: string) => ({ oldText: newText, newText: oldText });

export const summarizeDiff = (chunks: readonly DiffChunk[]): string => chunks
  .filter(({ kind }) => kind !== 'same')
  .map(({ kind, value }) => `${labels[kind]}：${value}${value.endsWith('\n') ? '' : '\n'}`)
  .join('');

export const renderDiff = (target: HTMLElement, chunks: readonly DiffChunk[]): void => {
  const { ownerDocument } = target;
  const fragment = ownerDocument.createDocumentFragment();
  for (const { kind, value } of chunks) {
    const row = ownerDocument.createElement('div');
    row.className = `tool-diff-row tool-diff-row--${kind}`;
    const label = ownerDocument.createElement('span');
    label.className = 'tool-diff-label';
    label.textContent = `${labels[kind]}：`;
    const content = ownerDocument.createElement('span');
    content.className = 'tool-diff-content';
    content.append(ownerDocument.createTextNode(value));
    row.append(label, content);
    fragment.append(row);
  }
  target.replaceChildren(fragment);
};
