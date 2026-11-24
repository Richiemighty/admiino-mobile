import type { NotificationRecord } from './service';

const TASK_NOTIFICATION_TYPES = new Set([
  'task_created',
  'task_updated',
  'task_assigned',
  'team_task_assigned',
  'subtask_assigned',
  'task_status_changed',
  'task_completed',
  'task_reopened',
  'task_review_required',
  'task_review_submitted',
  'task_review_reopened',
  'task_deadline_reminder',
  'task_due_reminder',
  'task_overdue',
  'task_mentioned',
  'task_reply',
  'comment_mentioned',
  'comment_reply',
  'comment_added',
]);

const PROJECT_NOTIFICATION_TYPES = new Set([
  'project_created',
  'project_member_added',
  'project_access_changed',
  'project_deleted',
  'project_status_changed',
]);

export type NotificationTarget =
  | { kind: 'task'; id: string }
  | { kind: 'project'; id: string }
  | { kind: 'join-request'; id: string }
  | { kind: 'access-request'; id: string };

function dataId(data: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

export function getNotificationTarget(notification: NotificationRecord): NotificationTarget | null {
  const data = notification.data;
  if (!data) return null;

  if (TASK_NOTIFICATION_TYPES.has(notification.type) || data.action === 'view_task') {
    const id = dataId(data, 'taskId', 'task_id');
    return id ? { kind: 'task', id } : null;
  }
  if (PROJECT_NOTIFICATION_TYPES.has(notification.type) || data.action === 'view_project') {
    const id = dataId(data, 'projectId', 'project_id');
    return id ? { kind: 'project', id } : null;
  }
  if (notification.type === 'workspace_join_requested') {
    const id = dataId(data, 'requestId');
    return id ? { kind: 'join-request', id } : null;
  }
  if (notification.type === 'access_request_created') {
    const id = dataId(data, 'requestId');
    return id ? { kind: 'access-request', id } : null;
  }
  return null;
}
