export { compareText } from './text-diff-engine.ts';
export { createTextDiffRunner } from './text-diff-worker-client.ts';

export type DiffChunk = { value: string; kind: 'same' | 'add' | 'remove' };
export type DiffMode = 'line' | 'word';

const labels: Record<DiffChunk['kind'], string> = {
  same: '未变',
  add: '新增',
  remove: '删除',
};

export const swapDiffInputs = (oldText: string, newText: string) => ({ oldText: newText, newText: oldText });

export const summarizeDiff = (chunks: readonly DiffChunk[]): string => chunks
  .filter(({ kind }) => kind !== 'same')
  .map(({ kind, value }) => {
    const lines = value.split('\n');
    if (value.endsWith('\n')) lines.pop();
    return lines.map((line) => `${labels[kind]}：${line}\n`).join('');
  })
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
