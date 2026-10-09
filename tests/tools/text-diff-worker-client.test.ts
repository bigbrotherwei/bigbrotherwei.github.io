import assert from 'node:assert/strict';
import test from 'node:test';
import { createTextDiffRunner } from '../../src/lib/tools/text-diff-worker-client.ts';

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: Array<{ id: number; oldText: string; newText: string; mode: string }> = [];
  terminated = false;

  postMessage(message: { id: number; oldText: string; newText: string; mode: string }) {
    this.posted.push(message);
  }

  terminate() { this.terminated = true; }

  reply(id: number, result: unknown) {
    this.onmessage?.({ data: { id, result } } as MessageEvent);
  }
}

const makeRunner = (timeoutMs = 20) => {
  const workers: FakeWorker[] = [];
  const runner = createTextDiffRunner(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  }, timeoutMs);
  return { runner, workers };
};

test('submits comparison to a worker and resolves its result asynchronously', async () => {
  const { runner, workers } = makeRunner();
  const pending = runner.run('旧', '新', 'line');
  assert.deepEqual(workers[0].posted[0], { id: 1, oldText: '旧', newText: '新', mode: 'line' });
  workers[0].reply(1, { ok: true, value: [{ kind: 'add', value: '新' }] });
  assert.deepEqual(await pending, { ok: true, value: [{ kind: 'add', value: '新' }] });
  runner.dispose();
});

test('times out a stuck worker, terminates it, and succeeds on a fresh worker', async () => {
  const { runner, workers } = makeRunner(5);
  const timedOut = runner.run('旧', '新', 'word');
  const failure = await timedOut;
  assert.equal(failure.ok, false);
  if (!failure.ok) assert.match(failure.error, /超时/);
  assert.equal(workers[0].terminated, true);
  assert.equal(workers.length, 2);

  const retry = runner.run('A', 'B', 'line');
  workers[1].reply(workers[1].posted[0].id, { ok: true, value: [{ kind: 'add', value: 'B' }] });
  assert.deepEqual(await retry, { ok: true, value: [{ kind: 'add', value: 'B' }] });
  runner.dispose();
});

test('superseding a request cancels it and ignores late replies from the old worker', async () => {
  const { runner, workers } = makeRunner();
  const first = runner.run('first', 'older', 'line');
  const oldHandler = workers[0].onmessage;
  const second = runner.run('second', 'latest', 'word');
  const cancelled = await first;
  assert.equal(cancelled.ok, false);
  if (!cancelled.ok) assert.match(cancelled.error, /取消/);
  assert.equal(workers[0].terminated, true);

  let secondSettled = false;
  void second.then(() => { secondSettled = true; });
  oldHandler?.({ data: { id: workers[0].posted[0].id, result: { ok: true, value: [{ kind: 'add', value: 'stale' }] } } } as MessageEvent);
  await Promise.resolve();
  assert.equal(secondSettled, false);
  workers[1].reply(workers[1].posted[0].id, { ok: true, value: [{ kind: 'add', value: 'latest' }] });
  assert.deepEqual(await second, { ok: true, value: [{ kind: 'add', value: 'latest' }] });
  runner.dispose();
});

test('cancel and dispose settle pending requests and terminate active workers', async () => {
  const { runner, workers } = makeRunner();
  const edited = runner.run('old', 'new', 'line');
  runner.cancel();
  assert.equal((await edited).ok, false);
  assert.equal(workers[0].terminated, true);
  const leaving = runner.run('old', 'new', 'line');
  runner.dispose();
  assert.equal((await leaving).ok, false);
  assert.equal(workers[1].terminated, true);
});
