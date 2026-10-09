import { runRegex } from '../lib/tools/regex.ts';

self.onmessage = (event: MessageEvent<{ id: number; pattern: string; flags: string; input: string }>) => {
  const { id, pattern, flags, input } = event.data;
  self.postMessage({ id, result: runRegex(pattern, flags, input) });
};
