import { beforeEach, describe, expect, it } from '@jest/globals';

import { cacheKey, cachePolicy, serverCache } from './serverCache';

describe('server cache', () => {
  beforeEach(() => serverCache.clearForTests());

  it('deduplicates requests and serves fresh data', async () => {
    let calls = 0;
    const key = cacheKey('workspace', 'w1', 'user', 'u1', 'tasks', 'assigned');
    const request = () => Promise.resolve(++calls);
    await expect(
      Promise.all([
        serverCache.fetch(key, request, { staleTime: cachePolicy.taskList }),
        serverCache.fetch(key, request, { staleTime: cachePolicy.taskList }),
      ]),
    ).resolves.toEqual([1, 1]);
    await expect(
      serverCache.fetch(key, request, { staleTime: cachePolicy.taskList }),
    ).resolves.toBe(1);
    expect(calls).toBe(1);
  });

  it('replaces stale data after a background refresh completes', async () => {
    const key = cacheKey('workspace', 'w1', 'user', 'u1', 'home');
    serverCache.set(key, { value: 'old' });
    expect(serverCache.get(key)).toEqual({ value: 'old' });
    await serverCache.fetch(key, async () => ({ value: 'new' }), { staleTime: -1 });
    expect(serverCache.get(key)).toEqual({ value: 'new' });
  });

  it('invalidates one workspace without touching another workspace', () => {
    serverCache.set(cacheKey('workspace', 'w1', 'user', 'u1', 'home'), 'one');
    serverCache.set(cacheKey('workspace', 'w2', 'user', 'u1', 'home'), 'two');
    serverCache.clearWorkspace('w1');
    expect(serverCache.get(cacheKey('workspace', 'w1', 'user', 'u1', 'home'))).toBeUndefined();
    expect(serverCache.get(cacheKey('workspace', 'w2', 'user', 'u1', 'home'))).toBe('two');
  });
});
