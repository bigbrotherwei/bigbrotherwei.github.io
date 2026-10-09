import type { ToolResult } from './result.ts';
import type { DiffChunk, DiffMode } from './text-diff.ts';

type DiffWorker = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror'>;
type DiffResult = ToolResult<DiffChunk[]>;
type Pending = {
  id: number;
  resolve: (result: DiffResult) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const cancelled: DiffResult = { ok: false, error: '差异计算已取消' };

export const createTextDiffRunner = (workerFactory: () => DiffWorker, timeoutMs = 1000) => {
  let worker = workerFactory();
  let pending: Pending | undefined;
  let nextId = 0;
  let disposed = false;

  const settle = (result: DiffResult) => {
    if (!pending) return;
    clearTimeout(pending.timeout);
    pending.resolve(result);
    pending = undefined;
  };

  const bind = (source: DiffWorker) => {
    source.onmessage = (event: MessageEvent<{ id: number; result: DiffResult }>) => {
      if (source !== worker || !pending || event.data.id !== pending.id) return;
      settle(event.data.result);
    };
    source.onerror = () => {
      if (source !== worker || !pending) return;
      settle({ ok: false, error: '差异计算失败，请重试' });
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
    run(oldText: string, newText: string, mode: DiffMode): Promise<DiffResult> {
      if (disposed) return Promise.resolve(cancelled);
      if (pending) {
        settle(cancelled);
        replaceWorker();
      }
      const id = ++nextId;
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (!pending || pending.id !== id) return;
          settle({ ok: false, error: '差异计算超时，请缩短文本后重试' });
          replaceWorker();
        }, timeoutMs);
        pending = { id, resolve, timeout };
        try {
          worker.postMessage({ id, oldText, newText, mode });
        } catch {
          settle({ ok: false, error: '差异计算失败，请重试' });
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
  };
};
