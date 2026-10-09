import { compareText } from '../lib/tools/text-diff-engine.ts';
import type { DiffMode } from '../lib/tools/text-diff.ts';

self.onmessage = (event: MessageEvent<{ id: number; oldText: string; newText: string; mode: DiffMode }>) => {
  const { id, oldText, newText, mode } = event.data;
  self.postMessage({ id, result: compareText(oldText, newText, mode) });
};
