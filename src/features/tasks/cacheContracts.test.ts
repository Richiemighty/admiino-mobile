import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { cacheKeys } from '../../data/cacheKeys';
import { cachePolicy, serverCache } from '../../data/serverCache';
import type { TaskDetails, TaskPerson } from './service';

const taskDetails: TaskDetails = {
  task: {
    id: 'task-1',
    companyId: 'workspace-1',
    title: 'Review launch plan',
    description: null,
    status: 'pending',
    priority: 'high',
    deadline: null,
    projectId: null,
    teamId: null,
    project: null,
    team: null,
    creator: null,
    assignee: null,
    assignees: [],
    subtasks: [],
    attachments: [],
    activities: [],
  },
  access: { canView: true, canEdit: true, readOnly: false },
};

const watcher: TaskPerson = { id: 'user-1', firstName: 'Sam', lastName: 'Member' };
const userId = 'user-1';
const workspaceId = 'workspace-1';
const taskKey = cacheKeys.task(userId, workspaceId, taskDetails.task.id);
const watcherKey = cacheKeys.watchers(userId, workspaceId, taskDetails.task.id);

describe('task and watcher cache contracts', () => {
  beforeEach(() => serverCache.clearForTests());

  it('shares the direct TaskDetails response from task prefetch with Task Details', async () => {
    const request = jest.fn(async () => taskDetails);

    await serverCache.fetch(taskKey, request, { staleTime: cachePolicy.taskDetails });
    const cached = serverCache.get<TaskDetails>(taskKey);

    expect(cached).toEqual(taskDetails);
    expect(cached?.access.canEdit).toBe(true);
    expect(cached).not.toHaveProperty('details');
    await expect(
      serverCache.fetch(taskKey, request, { staleTime: cachePolicy.taskDetails }),
    ).resolves.toEqual(taskDetails);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('lets Task Details populate the same shape consumed by task prefetch', async () => {
    const detailsRequest = jest.fn(async () => taskDetails);
    const prefetchRequest = jest.fn(async () => taskDetails);

    await serverCache.fetch(taskKey, detailsRequest, { staleTime: cachePolicy.taskDetails });
    const cached = serverCache.get<TaskDetails>(taskKey);
    expect(cached?.task.id).toBe(taskDetails.task.id);
    expect(cached?.access.canView).toBe(true);

    await serverCache.fetch(taskKey, prefetchRequest, { staleTime: cachePolicy.taskDetails });
    expect(prefetchRequest).not.toHaveBeenCalled();
  });

  it('reuses a fresh task result when the task is reopened', async () => {
    const request = jest.fn(async () => taskDetails);

    await serverCache.fetch(taskKey, request, { staleTime: cachePolicy.taskDetails });
    await serverCache.fetch(taskKey, request, { staleTime: cachePolicy.taskDetails });

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('stores watcher arrays and derives current-user state without changing the value type', async () => {
    const request = jest.fn(async () => [watcher]);

    await serverCache.fetch(watcherKey, request, { staleTime: cachePolicy.watchers });
    const cached = serverCache.get<TaskPerson[]>(watcherKey);

    expect(cached).toEqual([watcher]);
    expect(cached?.some((person) => person.id === userId)).toBe(true);
    expect(typeof cached).toBe('object');
    await serverCache.fetch(watcherKey, request, { staleTime: cachePolicy.watchers });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('revalidates stale watcher arrays and preserves the confirmed list after a failed refresh', async () => {
    const initialRequest = jest.fn(async () => [watcher]);
    const refreshedWatchers = [{ id: 'user-2', firstName: 'Taylor' }];
    const refreshRequest = jest.fn(async () => refreshedWatchers);

    await serverCache.fetch(watcherKey, initialRequest, { staleTime: cachePolicy.watchers });
    await serverCache.fetch(watcherKey, refreshRequest, { staleTime: -1 });
    expect(serverCache.get<TaskPerson[]>(watcherKey)).toEqual(refreshedWatchers);

    const failedRefresh = jest.fn(async () => {
      throw new Error('offline');
    });
    await expect(
      serverCache.fetch(watcherKey, failedRefresh, { staleTime: -1, force: true }),
    ).rejects.toThrow('offline');
    expect(serverCache.get<TaskPerson[]>(watcherKey)).toEqual(refreshedWatchers);
  });

  it('deduplicates concurrent requests and discards results after workspace invalidation', async () => {
    let resolve: (value: TaskPerson[]) => void = () => undefined;
    const pending = new Promise<TaskPerson[]>((next) => {
      resolve = next;
    });
    const request = jest.fn(() => pending);

    const first = serverCache.fetch(watcherKey, request, { staleTime: 0 });
    const second = serverCache.fetch(watcherKey, request, { staleTime: 0 });
    expect(request).toHaveBeenCalledTimes(1);
    serverCache.clearWorkspace(workspaceId);
    resolve([watcher]);
    await expect(Promise.all([first, second])).resolves.toEqual([[watcher], [watcher]]);
    expect(serverCache.get<TaskPerson[]>(watcherKey)).toBeUndefined();
  });
});
