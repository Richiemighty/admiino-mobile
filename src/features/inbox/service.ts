import { apiClient, ApiError } from '../../api';
import type { ApiClient } from '../../api/client';
import type { SessionService } from '../../auth/session';
import { sessionService } from '../../auth/session';

export const NOTIFICATION_PAGE_SIZE = 20;
export const NOTIFICATION_COUNT_PAGE_SIZE = 100;

export const NOTIFICATION_CATEGORIES = [
  'assignments',
  'mentions_replies',
  'status_review',
  'due_work',
  'project_team',
  'client_access',
  'workspace_commercial',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationChannel = 'inAppEnabled' | 'emailEnabled' | 'whatsAppEnabled';

export interface NotificationRecord {
  id: string;
  userId: string;
  companyId: string;
  type: string;
  title: string;
  message: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPage {
  notifications: NotificationRecord[];
  results: number;
  hasMore: boolean;
}

export interface NotificationPreference {
  category: NotificationCategory;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  whatsAppEnabled: boolean;
  explicit?: Partial<Record<NotificationChannel, boolean>>;
  eventDefaults?: {
    channel: NotificationChannel;
    types: string[];
    defaultEnabled: boolean;
    effectiveEnabled: boolean;
  }[];
}

export interface NotificationPreferences {
  preferences: NotificationPreference[];
  whatsApp: { linked: boolean; globallyEnabled: boolean };
}

export type NotificationPreferencePatch = {
  category: NotificationCategory;
} & Partial<Record<NotificationChannel, boolean>>;

interface NotificationListResponse {
  status: string;
  results: number;
  data: { notifications: unknown[] };
}

interface NotificationPreferencesResponse {
  status: string;
  data: {
    preferences: unknown[];
    whatsApp: { linked: boolean; globallyEnabled: boolean };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNotificationCategory(value: unknown): value is NotificationCategory {
  return NOTIFICATION_CATEGORIES.some((category) => category === value);
}

function isNotification(value: unknown, workspaceId: string): value is NotificationRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.userId === 'string' &&
    value.companyId === workspaceId &&
    typeof value.type === 'string' &&
    typeof value.title === 'string' &&
    isStringOrNull(value.message) &&
    (value.data === null || isRecord(value.data)) &&
    typeof value.isRead === 'boolean' &&
    isStringOrNull(value.readAt) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function parseNotification(value: unknown, workspaceId: string): NotificationRecord {
  if (!isNotification(value, workspaceId)) {
    throw new ApiError(
      'The backend returned a notification outside the active workspace or an invalid notification.',
      502,
    );
  }
  return value;
}

function isNotificationChannel(value: unknown): value is NotificationChannel {
  return value === 'inAppEnabled' || value === 'emailEnabled' || value === 'whatsAppEnabled';
}

function isPreference(value: unknown): value is NotificationPreference {
  if (!(
    isRecord(value) &&
    isNotificationCategory(value.category) &&
    typeof value.inAppEnabled === 'boolean' &&
    typeof value.emailEnabled === 'boolean' &&
    typeof value.whatsAppEnabled === 'boolean'
  )) {
    return false;
  }
  if (value.explicit !== undefined) {
    if (!isRecord(value.explicit)) return false;
    for (const channel of ['inAppEnabled', 'emailEnabled', 'whatsAppEnabled'] as const) {
      if (value.explicit[channel] !== undefined && typeof value.explicit[channel] !== 'boolean')
        return false;
    }
  }
  if (value.eventDefaults !== undefined) {
    if (!Array.isArray(value.eventDefaults)) return false;
    if (
      !value.eventDefaults.every(
        (entry) =>
          isRecord(entry) &&
          isNotificationChannel(entry.channel) &&
          Array.isArray(entry.types) &&
          entry.types.every((type) => typeof type === 'string') &&
          typeof entry.defaultEnabled === 'boolean' &&
          typeof entry.effectiveEnabled === 'boolean',
      )
    ) {
      return false;
    }
  }
  return true;
}

export class InboxService {
  constructor(
    private readonly client: ApiClient = apiClient,
    private readonly sessions: Pick<SessionService, 'getAccessToken'> = sessionService,
  ) {}

  async listNotifications(
    workspaceId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean; signal?: AbortSignal } = {},
  ): Promise<NotificationPage> {
    if (!workspaceId) throw new ApiError('Choose a workspace to open Inbox.', 400);
    const limit = options.limit ?? NOTIFICATION_PAGE_SIZE;
    const offset = options.offset ?? 0;
    const params = new URLSearchParams({
      companyOnly: 'true',
      limit: String(limit),
      offset: String(offset),
    });
    if (options.unreadOnly) params.set('unreadOnly', 'true');

    const token = await this.sessions.getAccessToken();
    const response = await this.client.get<NotificationListResponse>(
      `/notifications?${params.toString()}`,
      { token, workspaceId, signal: options.signal },
    );
    if (
      response.status !== 'success' ||
      !Number.isInteger(response.results) ||
      response.results < 0 ||
      !Array.isArray(response.data?.notifications)
    ) {
      throw new ApiError('The backend returned an invalid notifications response.', 502);
    }

    const notifications = response.data.notifications.map((row) =>
      parseNotification(row, workspaceId),
    );
    if (response.results !== notifications.length) {
      throw new ApiError('The backend returned an inconsistent notifications page.', 502);
    }
    return {
      notifications,
      results: response.results,
      hasMore: notifications.length === limit,
    };
  }

  async markNotificationRead(
    workspaceId: string,
    notification: NotificationRecord,
    signal?: AbortSignal,
  ): Promise<NotificationRecord> {
    if (!workspaceId || notification.companyId !== workspaceId) {
      throw new ApiError('This notification is not part of the active workspace.', 404);
    }
    const token = await this.sessions.getAccessToken();
    const response = await this.client.request<{
      status: string;
      data: { notification: unknown };
    }>(`/notifications/${encodeURIComponent(notification.id)}/read`, {
      method: 'PATCH',
      token,
      workspaceId,
      signal,
    });
    if (response.status !== 'success') {
      throw new ApiError('The notification could not be marked as read.', 502);
    }
    const updated = parseNotification(response.data?.notification, workspaceId);
    if (updated.id !== notification.id || !updated.isRead) {
      throw new ApiError('The backend did not confirm this notification as read.', 502);
    }
    return updated;
  }

  async getPreferences(signal?: AbortSignal): Promise<NotificationPreferences> {
    const token = await this.sessions.getAccessToken();
    const response = await this.client.get<NotificationPreferencesResponse>(
      '/notification-preferences',
      { token, signal },
    );
    if (
      response.status !== 'success' ||
      !Array.isArray(response.data?.preferences) ||
      !isRecord(response.data.whatsApp) ||
      typeof response.data.whatsApp.linked !== 'boolean' ||
      typeof response.data.whatsApp.globallyEnabled !== 'boolean'
    ) {
      throw new ApiError('The backend returned invalid notification preferences.', 502);
    }
    const preferences = response.data.preferences.map((preference) => {
      if (!isPreference(preference))
        throw new ApiError('The backend returned an invalid notification preference.', 502);
      return preference;
    });
    if (
      preferences.length !== NOTIFICATION_CATEGORIES.length ||
      new Set(preferences.map((preference) => preference.category)).size !==
        NOTIFICATION_CATEGORIES.length
    ) {
      throw new ApiError('The backend returned an incomplete notification preference matrix.', 502);
    }
    return {
      preferences,
      whatsApp: response.data.whatsApp,
    };
  }

  async updatePreferences(
    preferences: NotificationPreferencePatch[],
    signal?: AbortSignal,
  ): Promise<NotificationPreference[]> {
    if (!preferences.length) return [];
    const token = await this.sessions.getAccessToken();
    const response = await this.client.request<{
      status: string;
      data: { preferences: unknown[] };
    }>('/notification-preferences', {
      method: 'PATCH',
      body: { preferences },
      token,
      signal,
    });
    if (response.status !== 'success' || !Array.isArray(response.data?.preferences)) {
      throw new ApiError('The backend returned invalid saved notification preferences.', 502);
    }
    const updatedPreferences = response.data.preferences.map((preference) => {
      if (!isPreference(preference))
        throw new ApiError('The backend returned an invalid saved notification preference.', 502);
      return preference;
    });
    if (updatedPreferences.length !== NOTIFICATION_CATEGORIES.length) {
      throw new ApiError('The backend returned an incomplete saved preference matrix.', 502);
    }
    return updatedPreferences;
  }

  async countWorkspaceUnread(workspaceId: string, signal?: AbortSignal): Promise<number | null> {
    const preferences = await this.getPreferences(signal);
    if (preferences.preferences.some((preference) => !preference.inAppEnabled)) return null;

    let count = 0;
    let offset = 0;
    const seenIds = new Set<string>();
    while (true) {
      const page = await this.listNotifications(workspaceId, {
        limit: NOTIFICATION_COUNT_PAGE_SIZE,
        offset,
        unreadOnly: true,
        signal,
      });
      for (const notification of page.notifications) {
        if (seenIds.has(notification.id)) {
          throw new ApiError('The backend returned a duplicate notification page.', 502);
        }
        seenIds.add(notification.id);
      }
      count += page.notifications.length;
      if (!page.hasMore) return count;
      offset += NOTIFICATION_COUNT_PAGE_SIZE;
    }
  }
}

export const inboxService = new InboxService();
