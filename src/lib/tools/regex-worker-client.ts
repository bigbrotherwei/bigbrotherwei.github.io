import type { ToolResult } from './result.ts';
import { validateRegexRequest, type RegexResults } from './regex.ts';

type RegexWorker = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror'>;
type RegexResult = ToolResult<RegexResults>;
type Pending = { id: number; resolve: (result: RegexResult) => void; timeout: ReturnType<typeof setTimeout> };
const cancelled: RegexResult = { ok: false, error: '正则测试已取消' };

export const createRegexRunner = (workerFactory: () => RegexWorker, timeoutMs = 1000) => {
  let worker = workerFactory();
  let pending: Pending | undefined;
  let nextId = 0;
  let disposed = false;

  const settle = (result: RegexResult) => {
    if (!pending) return;
    clearTimeout(pending.timeout);
    pending.resolve(result);
    pending = undefined;
  };
  const bind = (source: RegexWorker) => {
    source.onmessage = (event: MessageEvent<{ id: number; result: RegexResult }>) => {
      if (source !== worker || !pending || event.data.id !== pending.id) return;
      settle(event.data.result);
    };
    source.onerror = () => {
      if (source !== worker || !pending) return;
      settle({ ok: false, error: '正则测试失败，请重试' });
      replaceWorker();
    };
  };
  const replaceWorker = () => {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
    worker = workerFactory();
    bind(worker);
  };
  bind(worker);

  return {
    run(pattern: string, flags: string, input: string): Promise<RegexResult> {
      if (disposed) return Promise.resolve(cancelled);
      if (pending) {
        settle(cancelled);
        replaceWorker();
      }
      const validation = validateRegexRequest(pattern, flags, input);
      if (!validation.ok) return Promise.resolve(validation);
      const id = ++nextId;
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (!pending || pending.id !== id) return;
          settle({ ok: false, error: '正则测试超时，请缩短表达式或测试文本后重试' });
          replaceWorker();
        }, timeoutMs);
        pending = { id, resolve, timeout };
        try {
          worker.postMessage({ id, pattern, flags, input });
        } catch {
          settle({ ok: false, error: '正则测试失败，请重试' });
          replaceWorker();
        }
      });
    },
    cancel() {
      if (!pending || disposed) return;
      settle(cancelled);
      replaceWorker();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      settle(cancelled);
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    },
    resume() {
      if (!disposed) return;
      worker = workerFactory();
      bind(worker);
      disposed = false;
    },
  };
};
