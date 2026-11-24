import { describe, expect, it } from '@jest/globals';

import { getNotificationTarget } from './notificationTarget';
import type { NotificationRecord } from './service';

const base: NotificationRecord = {
  id: 'notice-1',
  userId: 'user-1',
  companyId: 'workspace-1',
  type: 'unknown_event',
  title: 'Update',
  message: null,
  data: {},
  isRead: false,
  readAt: null,
  createdAt: '2026-03-16T12:00:00.000Z',
  updatedAt: '2026-03-16T12:00:00.000Z',
};

describe('notification destinations', () => {
  it('uses verified task, project, and approval identifiers only', () => {
    expect(
      getNotificationTarget({
        ...base,
        type: 'task_assigned',
        data: { taskId: 'task-1' },
      }),
    ).toEqual({ kind: 'task', id: 'task-1' });
    expect(
      getNotificationTarget({
        ...base,
        type: 'project_member_added',
        data: { project_id: 'project-1' },
      }),
    ).toEqual({ kind: 'project', id: 'project-1' });
    expect(
      getNotificationTarget({
        ...base,
        type: 'workspace_join_requested',
        data: { requestId: 'join-1' },
      }),
    ).toEqual({ kind: 'join-request', id: 'join-1' });
    expect(
      getNotificationTarget({
        ...base,
        type: 'access_request_created',
        data: { requestId: 'access-1' },
      }),
    ).toEqual({ kind: 'access-request', id: 'access-1' });
  });

  it('does not infer destinations from notification text or unknown event types', () => {
    expect(
      getNotificationTarget({
        ...base,
        title: 'Task assigned to you',
        message: 'Open project 123',
        data: { taskId: 'task-1' },
      }),
    ).toBeNull();
    expect(
      getNotificationTarget({
        ...base,
        type: 'project_member_added',
        data: {},
      }),
    ).toBeNull();
  });
});
