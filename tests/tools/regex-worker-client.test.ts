import assert from 'node:assert/strict';
import test from 'node:test';
import { createRegexRunner } from '../../src/lib/tools/regex-worker-client.ts';

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: Array<{ id: number; pattern: string; flags: string; input: string }> = [];
  terminated = false;
  postMessage(message: { id: number; pattern: string; flags: string; input: string }) { this.posted.push(message); }
  terminate() { this.terminated = true; }
  reply(id: number, result: unknown) { this.onmessage?.({ data: { id, result } } as MessageEvent); }
}

const makeRunner = (timeoutMs = 20) => {
  const workers: FakeWorker[] = [];
  const runner = createRegexRunner(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  }, timeoutMs);
  return { runner, workers };
};

test('prevalidates limits and syntax before posting to worker', async () => {
  const { runner, workers } = makeRunner();
  for (const [pattern, flags, input] of [['a'.repeat(501), 'g', ''], ['a', 'x', ''], ['(', '', ''], ['a', '', 'a'.repeat(100_001)]]) {
    assert.equal((await runner.run(pattern, flags, input)).ok, false);
  }
  assert.equal(workers[0].posted.length, 0);
  runner.dispose();
});

test('times out, terminates the worker, then succeeds after recreation', async () => {
  const { runner, workers } = makeRunner(5);
  const timedOut = await runner.run('(a+)+$', '', 'a'.repeat(100) + '!');
  assert.equal(timedOut.ok, false);
  if (!timedOut.ok) assert.match(timedOut.error, /超时/);
  assert.equal(workers[0].terminated, true);
  const pending = runner.run('b', 'g', 'bbb');
  workers[1].reply(workers[1].posted[0].id, { ok: true, value: { matches: [], truncated: false } });
  assert.equal((await pending).ok, true);
  runner.dispose();
});

test('superseding, cancellation and bfcache restoration settle stale requests', async () => {
  const { runner, workers } = makeRunner();
  const first = runner.run('a', '', 'a');
  const stale = workers[0].onmessage;
  const second = runner.run('b', '', 'b');
  assert.equal((await first).ok, false);
  assert.equal(workers[0].terminated, true);
  stale?.({ data: { id: 1, result: { ok: true, value: { matches: [], truncated: false } } } } as MessageEvent);
  runner.dispose();
  assert.equal((await second).ok, false);
  runner.resume();
  const restored = runner.run('c', '', 'c');
  workers[2].reply(workers[2].posted[0].id, { ok: true, value: { matches: [], truncated: false } });
  assert.equal((await restored).ok, true);
  runner.dispose();
});
