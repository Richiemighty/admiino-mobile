import { describe, expect, it } from '@jest/globals';

import { ApiClient, ApiError } from '../../api';
import { SessionService } from '../../auth/session';
import type { SecureSessionStorage } from '../../auth/sessionStorage';
import {
  InboxService,
  NOTIFICATION_CATEGORIES,
  type NotificationPreference,
  type NotificationRecord,
} from './service';

const workspaceId = 'workspace-1';

const notification: NotificationRecord = {
  id: 'notification-1',
  userId: 'user-1',
  companyId: workspaceId,
  type: 'task_assigned',
  title: 'Task assigned',
  message: 'Review the plan',
  data: { taskId: 'task-1', action: 'view_task' },
  isRead: false,
  readAt: null,
  createdAt: '2026-03-16T12:00:00.000Z',
  updatedAt: '2026-03-16T12:00:00.000Z',
};

const preferences: NotificationPreference[] = NOTIFICATION_CATEGORIES.map((category) => ({
  category,
  inAppEnabled: true,
  emailEnabled: true,
  whatsAppEnabled: false,
}));

const storage: SecureSessionStorage = {
  getAccessToken: async () => 'secure-access-token',
  setAccessToken: async () => undefined,
  clearAccessToken: async () => undefined,
  getActiveWorkspaceId: async () => null,
  setActiveWorkspaceId: async () => undefined,
  clearActiveWorkspaceId: async () => undefined,
  clearSession: async () => undefined,
};

function serviceFor(
  respond: (url: URL, init: RequestInit) => unknown,
  requests: { url: URL; init: RequestInit }[] = [],
): InboxService {
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    return new Response(JSON.stringify(respond(url, init)), { status: 200 });
  };
  return new InboxService(
    new ApiClient('https://api.admiino.com/api/v1', fetchImpl),
    new SessionService(storage),
  );
}

describe('P14 notification API contracts', () => {
  it('uses the active workspace and server-side unread filter with offset pagination', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(
      () => ({ status: 'success', results: 1, data: { notifications: [notification] } }),
      requests,
    );

    await expect(
      service.listNotifications(workspaceId, {
        limit: 20,
        offset: 40,
        unreadOnly: true,
      }),
    ).resolves.toMatchObject({ notifications: [notification], hasMore: false });

    expect(requests[0]?.url.pathname).toBe('/api/v1/notifications');
    expect(requests[0]?.url.searchParams.get('companyOnly')).toBe('true');
    expect(requests[0]?.url.searchParams.get('unreadOnly')).toBe('true');
    expect(requests[0]?.url.searchParams.get('limit')).toBe('20');
    expect(requests[0]?.url.searchParams.get('offset')).toBe('40');
    expect(new Headers(requests[0]?.init.headers).get('x-company-id')).toBe(workspaceId);
    expect(new Headers(requests[0]?.init.headers).get('Authorization')).toBe(
      'Bearer secure-access-token',
    );
  });

  it('rejects notifications returned outside the selected workspace', async () => {
    const service = serviceFor(() => ({
      status: 'success',
      results: 1,
      data: { notifications: [{ ...notification, companyId: 'workspace-2' }] },
    }));

    await expect(service.listNotifications(workspaceId)).rejects.toMatchObject({
      status: 502,
    });
  });

  it('marks a notification read only when it belongs to the selected workspace', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(
      () => ({
        status: 'success',
        data: {
          notification: {
            ...notification,
            isRead: true,
            readAt: '2026-03-16T12:05:00.000Z',
          },
        },
      }),
      requests,
    );
    const updated = await service.markNotificationRead(workspaceId, notification);
    expect(updated.isRead).toBe(true);
    expect(requests[0]?.url.pathname).toBe('/api/v1/notifications/notification-1/read');
    expect(requests[0]?.init.method).toBe('PATCH');
    expect(new Headers(requests[0]?.init.headers).get('x-company-id')).toBe(workspaceId);

    await expect(service.markNotificationRead('workspace-2', notification)).rejects.toMatchObject({
      status: 404,
    });
    expect(requests).toHaveLength(1);
  });

  it('derives an exact workspace unread count from the scoped list when in-app preferences allow it', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      ...notification,
      id: `notification-${index}`,
    }));
    const secondPage = [{ ...notification, id: 'notification-100' }];
    const service = serviceFor((url) => {
      if (url.pathname.endsWith('/notification-preferences')) {
        return {
          status: 'success',
          data: { preferences, whatsApp: { linked: false, globallyEnabled: true } },
        };
      }
      const offset = Number(url.searchParams.get('offset'));
      const page = offset === 0 ? firstPage : secondPage;
      return { status: 'success', results: page.length, data: { notifications: page } };
    }, requests);

    await expect(service.countWorkspaceUnread(workspaceId)).resolves.toBe(101);
    expect(requests.filter(({ url }) => url.pathname.endsWith('/notifications'))).toHaveLength(2);
    expect(requests[1]?.url.searchParams.get('companyOnly')).toBe('true');
    expect(requests[1]?.url.searchParams.get('unreadOnly')).toBe('true');
  });

  it('does not substitute the cross-workspace unread-count endpoint when preference filtering obscures page totals', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const disabledPreferences = preferences.map((row) =>
      row.category === 'assignments' ? { ...row, inAppEnabled: false } : row,
    );
    const service = serviceFor(
      () => ({
        status: 'success',
        data: {
          preferences: disabledPreferences,
          whatsApp: { linked: false, globallyEnabled: true },
        },
      }),
      requests,
    );

    await expect(service.countWorkspaceUnread(workspaceId)).resolves.toBeNull();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url.pathname).toBe('/api/v1/notification-preferences');
    expect(requests.some(({ url }) => url.pathname.endsWith('/unread-count'))).toBe(false);
  });

  it('sends only changed preference channels and validates the saved matrix', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(() => ({ status: 'success', data: { preferences } }), requests);
    const patch = [{ category: 'assignments' as const, emailEnabled: false }];

    await expect(service.updatePreferences(patch)).resolves.toEqual(preferences);
    expect(requests[0]?.url.pathname).toBe('/api/v1/notification-preferences');
    expect(requests[0]?.init.method).toBe('PATCH');
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({ preferences: patch });
    expect(new Headers(requests[0]?.init.headers).get('x-company-id')).toBeNull();
  });

  it('surfaces malformed response shapes instead of returning empty notifications', async () => {
    const service = serviceFor(() => ({ status: 'success', results: 0, data: {} }));
    await expect(service.listNotifications(workspaceId)).rejects.toBeInstanceOf(ApiError);
  });
});
