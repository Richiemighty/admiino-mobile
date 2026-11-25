import { describe, expect, it, jest } from '@jest/globals';

import { TaskPrefetchQueue } from './taskPrefetchQueue';

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('TaskPrefetchQueue', () => {
  it('never exceeds the configured concurrent request limit', async () => {
    const queue = new TaskPrefetchQueue(3);
    const jobs = Array.from({ length: 7 }, () => deferred());
    let running = 0;
    let maximum = 0;

    jobs.forEach((job, index) => {
      queue.enqueue({
        key: `task-${index}`,
        priority: 'lookahead',
        run: async () => {
          running += 1;
          maximum = Math.max(maximum, running);
          await job.promise;
          running -= 1;
        },
      });
    });

    await Promise.resolve();
    expect(maximum).toBe(3);
    jobs.slice(0, 3).forEach((job) => job.resolve());
    await Promise.resolve();
    jobs.slice(3, 6).forEach((job) => job.resolve());
    jobs.slice(6).forEach((job) => job.resolve());
    await new Promise((resolve) => setImmediate(resolve));
    expect(maximum).toBe(3);
  });

  it('prioritises visible jobs before queued lookahead jobs', async () => {
    const queue = new TaskPrefetchQueue(1);
    const order: string[] = [];
    const first = deferred();

    queue.enqueue({
      key: 'lookahead-1',
      priority: 'lookahead',
      run: async () => {
        order.push('lookahead-1');
        await first.promise;
      },
    });
    await Promise.resolve();
    queue.enqueue({
      key: 'visible-1',
      priority: 'visible',
      run: async () => {
        order.push('visible-1');
      },
    });
    queue.enqueue({
      key: 'lookahead-2',
      priority: 'lookahead',
      run: async () => {
        order.push('lookahead-2');
      },
    });

    await Promise.resolve();
    expect(order).toEqual(['lookahead-1']);
    first.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    expect(order).toEqual(['lookahead-1', 'visible-1', 'lookahead-2']);
  });

  it('deduplicates pending and active keys', async () => {
    const queue = new TaskPrefetchQueue(1);
    const job = deferred();
    const run = jest.fn(async () => job.promise);

    expect(queue.enqueue({ key: 'same', priority: 'visible', run })).toBe(true);
    expect(queue.enqueue({ key: 'same', priority: 'visible', run })).toBe(false);
    await Promise.resolve();
    expect(queue.enqueue({ key: 'same', priority: 'visible', run })).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    job.resolve();
  });
});
