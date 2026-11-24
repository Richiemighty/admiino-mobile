import { router, useFocusEffect } from 'expo-router';
import {
  Bell,
  ChevronRight,
  ClipboardCheck,
  FolderKanban,
  Settings,
  ShieldCheck,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import {
  AppButton,
  AppCard,
  AppScreen,
  AppText,
  InlineError,
  LoadingState,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { projectService } from '../projects/service';
import { taskService } from '../tasks/service';
import { workspaceApprovalsService } from './approvalsService';
import { useInboxCount } from './InboxCountProvider';
import { getNotificationTarget } from './notificationTarget';
import { inboxService, NOTIFICATION_PAGE_SIZE, type NotificationRecord } from './service';

type InboxFilter = 'all' | 'unread';
type InboxCategory = 'updates' | 'requests';
type LoadedPage = {
  workspaceId: string;
  filter: InboxFilter;
  notifications: NotificationRecord[];
  hasMore: boolean;
  nextOffset: number;
};
type GroupedRow =
  | { kind: 'heading'; key: string; label: string }
  | {
      kind: 'notification';
      key: string;
      notification: NotificationRecord;
    };

const EMPTY_NOTIFICATIONS: NotificationRecord[] = [];

function isReviewer(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager';
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function notificationContext(notification: NotificationRecord): string | null {
  if (
    notification.type.startsWith('task_') ||
    notification.type === 'team_task_assigned' ||
    notification.type === 'subtask_assigned' ||
    notification.data?.action === 'view_task'
  ) {
    return 'Task';
  }
  if (notification.type.startsWith('project_') || notification.data?.action === 'view_project') {
    return 'Project';
  }
  const workspaceName = notification.data?.workspaceName;
  return typeof workspaceName === 'string' ? workspaceName : null;
}

function notificationIcon(type: string, color: string) {
  if (type.startsWith('task_') || type === 'team_task_assigned' || type === 'subtask_assigned')
    return <ClipboardCheck color={color} size={17} />;
  if (type.startsWith('project_')) return <FolderKanban color={color} size={17} />;
  if (type.includes('access') || type.includes('join'))
    return <ShieldCheck color={color} size={17} />;
  return <Bell color={color} size={17} />;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError)
    return 'You appear to be offline. Reconnect and try loading the Inbox again.';
  if (error instanceof ApiTimeoutError) return 'Loading the Inbox took too long. Please try again.';
  if (error instanceof ApiError && error.status === 403)
    return 'Inbox access changed. Refresh to check your workspace permissions.';
  if (error instanceof ApiError && error.status === 404)
    return 'This update is no longer available in the active workspace.';
  if (error instanceof ApiError && error.status === 423)
    return 'This workspace is temporarily suspended.';
  if (error instanceof ApiError && error.status === 429)
    return 'Too many requests. Wait a moment, then try again.';
  return 'The Inbox could not be loaded. Please try again.';
}

function markReadErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError)
    return 'You appear to be offline. Reconnect and try marking this update as read.';
  if (error instanceof ApiTimeoutError)
    return 'Marking this update as read took too long. Please try again.';
  if (error instanceof ApiError && error.status === 403)
    return 'You no longer have permission to change this update.';
  if (error instanceof ApiError && error.status === 404)
    return 'This update is no longer available.';
  if (error instanceof ApiError && error.status === 429)
    return 'Too many requests. Wait a moment, then try again.';
  return 'This update could not be marked as read. Please try again.';
}

function targetErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403)
    return 'You no longer have permission to open this update.';
  if (error instanceof ApiError && error.status === 404)
    return 'This item was deleted or is no longer available in the active workspace.';
  if (error instanceof ApiError && error.status === 423)
    return 'This workspace is temporarily suspended.';
  if (error instanceof ApiNetworkError || error instanceof ApiTimeoutError)
    return 'The destination could not be checked. Reconnect and try again.';
  return 'This update could not be opened. It may have been removed or access may have changed.';
}

function localGroup(value: string, today: string): string {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime()) && date.toDateString() === today) return 'Today';
  return 'Earlier';
}

function groupedRows(notifications: NotificationRecord[]): GroupedRow[] {
  const today = new Date().toDateString();
  const result: GroupedRow[] = [];
  let currentGroup = '';
  for (const notification of notifications) {
    const group = localGroup(notification.createdAt, today);
    if (group !== currentGroup) {
      result.push({ kind: 'heading', key: `heading-${group}`, label: group });
      currentGroup = group;
    }
    result.push({
      kind: 'notification',
      key: notification.id,
      notification,
    });
  }
  return result;
}

function SegmentedControl<T extends string>({
  accessibilityLabel,
  options,
  value,
  onChange,
}: {
  accessibilityLabel: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        padding: 3,
        borderRadius: themeTokens.radius.pill,
        backgroundColor: colors.surfaceSubtle,
      }}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: themeTokens.radius.pill,
              backgroundColor: selected ? colors.surface : 'transparent',
            }}
          >
            <AppText tone={selected ? 'primary' : 'secondary'} variant="caption">
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function NotificationRow({
  notification,
  opening,
  markingRead,
  onOpen,
  onMarkRead,
}: {
  notification: NotificationRecord;
  opening: boolean;
  markingRead: boolean;
  onOpen: () => void;
  onMarkRead: () => void;
}) {
  const { colors } = useAppTheme();
  const context = notificationContext(notification);
  const target = getNotificationTarget(notification);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: themeTokens.spacing.sm,
        paddingVertical: themeTokens.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primarySurface,
          marginTop: 2,
        }}
      >
        {notificationIcon(notification.type, colors.primaryAction)}
      </View>
      <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
        <Pressable
          accessibilityLabel={`${notification.isRead ? '' : 'Unread. '}${notification.title}${target ? '. Open update' : ''}`}
          accessibilityRole={target ? 'button' : undefined}
          disabled={!target || opening}
          onPress={onOpen}
          style={{ minHeight: themeTokens.touchTarget.minimum, justifyContent: 'center' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
            {!notification.isRead && (
              <View
                style={{
                  width: 7,
                  height: 7,
                  marginTop: 6,
                  borderRadius: 4,
                  backgroundColor: colors.primaryAction,
                }}
              />
            )}
            <AppText
              numberOfLines={2}
              style={{ flex: 1 }}
              variant={notification.isRead ? 'body' : 'label'}
            >
              {notification.title}
            </AppText>
            {target && <ChevronRight color={colors.textMuted} size={16} />}
          </View>
          {notification.message ? (
            <AppText numberOfLines={2} tone="secondary" variant="caption">
              {notification.message}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {context ? (
              <AppText tone="secondary" variant="caption">
                {context}
              </AppText>
            ) : null}
            <AppText tone="secondary" variant="caption">
              {dateLabel(notification.createdAt)}
            </AppText>
          </View>
        </Pressable>
        {!notification.isRead && (
          <Pressable
            accessibilityLabel={`Mark ${notification.title} as read`}
            accessibilityRole="button"
            accessibilityState={{ busy: markingRead, disabled: markingRead }}
            disabled={markingRead}
            onPress={onMarkRead}
            style={{ minHeight: 36, alignSelf: 'flex-start', justifyContent: 'center' }}
          >
            <AppText tone="link" variant="caption">
              {markingRead ? 'Marking read…' : 'Mark as read'}
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function InboxScreen() {
  const { activeWorkspace, permissions, status, workspacePermissionStatus, logout } = useAuth();
  const workspaceId = activeWorkspace?.companyId ?? null;
  if (!workspaceId) {
    return (
      <AppScreen>
        <LoadingState label="Verifying workspace access" variant="fullScreen" />
      </AppScreen>
    );
  }
  return (
    <InboxContent
      key={workspaceId}
      canReviewRequests={isReviewer(permissions?.role)}
      isReady={status === 'authenticated' && workspacePermissionStatus === 'ready'}
      logout={logout}
      role={permissions?.role}
      workspaceId={workspaceId}
    />
  );
}

function InboxContent({
  workspaceId,
  canReviewRequests,
  isReady,
  logout,
  role,
}: {
  workspaceId: string;
  canReviewRequests: boolean;
  isReady: boolean;
  logout: () => Promise<void>;
  role?: string;
}) {
  const { colors } = useAppTheme();
  const { unreadCount, countError, refreshUnreadCount } = useInboxCount();
  const [category, setCategory] = useState<InboxCategory>('updates');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [markingReadIds, setMarkingReadIds] = useState<Set<string>>(() => new Set());
  const request = useRef<AbortController | null>(null);
  const activeWorkspace = useRef<string | null>(workspaceId);
  const loadMoreInProgress = useRef(false);
  const openingInProgress = useRef(false);
  const markingReadInProgress = useRef(new Set<string>());

  useEffect(() => {
    return () => {
      activeWorkspace.current = null;
      request.current?.abort();
    };
  }, []);

  const activeCategory = canReviewRequests ? category : 'updates';

  const currentPage =
    loaded?.workspaceId === workspaceId && loaded.filter === filter ? loaded : null;
  const notifications = currentPage?.notifications ?? EMPTY_NOTIFICATIONS;
  const rows = useMemo(() => groupedRows(notifications), [notifications]);

  const handleFatal = useCallback(
    async (requestError: unknown) => {
      if (requestError instanceof ApiError && requestError.status === 401) {
        try {
          await logout();
          router.replace('/sign-in');
        } catch {
          setError('Your session could not be cleared safely. Please try again.');
        }
        return true;
      }
      if (requestError instanceof ApiError && requestError.status === 423) {
        router.replace('/workspace-suspended');
      }
      return false;
    },
    [logout],
  );

  const loadFirstPage = useCallback(
    async (controller: AbortController, isRefresh: boolean) => {
      setLoading(!isRefresh);
      setRefreshing(isRefresh);
      setError(null);
      setOperationError(null);
      try {
        const page = await inboxService.listNotifications(workspaceId, {
          limit: NOTIFICATION_PAGE_SIZE,
          offset: 0,
          unreadOnly: filter === 'unread',
          signal: controller.signal,
        });
        if (controller.signal.aborted || activeWorkspace.current !== workspaceId) return;
        setLoaded({
          workspaceId,
          filter,
          notifications: page.notifications,
          hasMore: page.hasMore,
          nextOffset: NOTIFICATION_PAGE_SIZE,
        });
        void refreshUnreadCount();
      } catch (requestError) {
        if (controller.signal.aborted || activeWorkspace.current !== workspaceId) return;
        const handled = await handleFatal(requestError);
        if (!handled) setError(errorMessage(requestError));
      } finally {
        if (!controller.signal.aborted && activeWorkspace.current === workspaceId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [filter, handleFatal, refreshUnreadCount, workspaceId],
  );

  useFocusEffect(
    useCallback(() => {
      if (!isReady) return undefined;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      void loadFirstPage(controller, false);
      return () => {
        controller.abort();
        if (request.current === controller) request.current = null;
      };
    }, [isReady, loadFirstPage]),
  );

  const refresh = () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    void loadFirstPage(controller, true);
  };

  const loadMore = async () => {
    if (
      !currentPage?.hasMore ||
      loadMoreInProgress.current ||
      loading ||
      activeCategory !== 'updates'
    )
      return;
    loadMoreInProgress.current = true;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await inboxService.listNotifications(workspaceId, {
        limit: NOTIFICATION_PAGE_SIZE,
        offset: currentPage.nextOffset,
        unreadOnly: filter === 'unread',
        signal: controller.signal,
      });
      if (controller.signal.aborted || activeWorkspace.current !== workspaceId) return;
      setLoaded((previous) => {
        if (!previous || previous.workspaceId !== workspaceId || previous.filter !== filter)
          return previous;
        const seen = new Set(previous.notifications.map((notification) => notification.id));
        const next = page.notifications.filter((notification) => !seen.has(notification.id));
        return {
          ...previous,
          notifications: [...previous.notifications, ...next],
          hasMore: page.hasMore,
          nextOffset: previous.nextOffset + NOTIFICATION_PAGE_SIZE,
        };
      });
    } catch (requestError) {
      if (controller.signal.aborted || activeWorkspace.current !== workspaceId) return;
      const handled = await handleFatal(requestError);
      if (!handled) setError(errorMessage(requestError));
    } finally {
      if (activeWorkspace.current === workspaceId) setLoadingMore(false);
      loadMoreInProgress.current = false;
    }
  };

  const markRead = async (notification: NotificationRecord) => {
    if (markingReadInProgress.current.has(notification.id)) return;
    markingReadInProgress.current.add(notification.id);
    setMarkingReadIds((current) => new Set(current).add(notification.id));
    setOperationError(null);
    try {
      const updated = await inboxService.markNotificationRead(workspaceId, notification);
      if (activeWorkspace.current !== workspaceId) return;
      if (filter === 'unread') {
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        void loadFirstPage(controller, true);
      } else {
        setLoaded((previous) =>
          !previous || previous.workspaceId !== workspaceId
            ? previous
            : {
                ...previous,
                notifications: previous.notifications.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
              },
        );
      }
      void refreshUnreadCount();
    } catch (requestError) {
      if (activeWorkspace.current !== workspaceId) return;
      const handled = await handleFatal(requestError);
      if (!handled) setOperationError(markReadErrorMessage(requestError));
    } finally {
      markingReadInProgress.current.delete(notification.id);
      if (activeWorkspace.current === workspaceId) {
        setMarkingReadIds((current) => {
          const next = new Set(current);
          next.delete(notification.id);
          return next;
        });
      }
    }
  };

  const openNotification = async (notification: NotificationRecord) => {
    const target = getNotificationTarget(notification);
    if (!target || !workspaceId || openingInProgress.current) return;
    openingInProgress.current = true;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setOpeningId(notification.id);
    setOperationError(null);
    try {
      if (target.kind === 'task' || target.kind === 'task-comment') {
        await taskService.getTask(
          target.kind === 'task' ? target.id : target.taskId,
          workspaceId,
          controller.signal,
        );
      } else if (target.kind === 'project') {
        await projectService.getProject(target.id, workspaceId, controller.signal);
      } else if (target.kind === 'join-request') {
        await workspaceApprovalsService.getJoinRequest(workspaceId, target.id, controller.signal);
      } else {
        const requests = await workspaceApprovalsService.listAccessRequests(
          workspaceId,
          controller.signal,
        );
        if (!requests.some((requestItem) => requestItem.id === target.id)) {
          throw new ApiError('This permission request is no longer pending or available.', 404);
        }
      }
      if (controller.signal.aborted || activeWorkspace.current !== workspaceId) return;
      if (!notification.isRead) {
        try {
          const updated = await inboxService.markNotificationRead(workspaceId, notification);
          if (controller.signal.aborted || activeWorkspace.current !== workspaceId) return;
          setLoaded((previous) =>
            !previous || previous.workspaceId !== workspaceId
              ? previous
              : {
                  ...previous,
                  notifications: previous.notifications.map((item) =>
                    item.id === updated.id ? updated : item,
                  ),
                },
          );
          void refreshUnreadCount();
        } catch (readError) {
          if (readError instanceof ApiError && readError.status === 401) {
            await handleFatal(readError);
            return;
          }
          setOperationError('The update opened, but could not be marked as read.');
        }
      }
      if (activeWorkspace.current === workspaceId && !controller.signal.aborted) {
        if (target.kind === 'task') {
          router.push({ pathname: '/tasks/[id]', params: { id: target.id, returnTo: 'inbox' } });
        } else if (target.kind === 'task-comment') {
          router.push({
            pathname: '/tasks/[id]/conversation',
            params: {
              id: target.taskId,
              commentId: target.commentId,
              fromInbox: '1',
            },
          });
        } else if (target.kind === 'project') {
          router.push({
            pathname: '/projects/[id]',
            params: { id: target.id, returnTo: 'inbox' },
          });
        } else {
          router.push({
            pathname: '/approvals',
            params: {
              category: target.kind === 'join-request' ? 'join' : 'permissions',
              requestId: target.id,
            },
          });
        }
      }
    } catch (requestError) {
      if (controller.signal.aborted || activeWorkspace.current !== workspaceId) return;
      const handled = await handleFatal(requestError);
      if (!handled) setOperationError(targetErrorMessage(requestError));
    } finally {
      openingInProgress.current = false;
      if (activeWorkspace.current === workspaceId) setOpeningId(null);
    }
  };

  if (!isReady) {
    return (
      <AppScreen>
        <LoadingState label="Verifying workspace access" variant="fullScreen" />
      </AppScreen>
    );
  }

  const header = (
    <View style={{ gap: themeTokens.spacing.md, marginBottom: themeTokens.spacing.sm }}>
      <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <AppText accessibilityRole="header" variant="heading">
            Inbox
            {unreadCount !== null && unreadCount > 0 ? ` · ${unreadCount}` : ''}
          </AppText>
          {countError ? (
            <AppText accessibilityRole="text" tone="secondary" variant="caption">
              Unread count unavailable
            </AppText>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel="Notification settings"
          accessibilityRole="button"
          onPress={() => router.push('/notification-settings')}
          style={{
            width: themeTokens.touchTarget.minimum,
            height: themeTokens.touchTarget.minimum,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Settings color={colors.text} size={20} />
        </Pressable>
      </View>
      <SegmentedControl
        accessibilityLabel="Inbox category"
        onChange={setCategory}
        options={[
          { value: 'updates', label: 'Updates' },
          ...(canReviewRequests ? [{ value: 'requests' as const, label: 'Requests' }] : []),
        ]}
        value={activeCategory}
      />
      {activeCategory === 'updates' ? (
        <SegmentedControl
          accessibilityLabel="Notification filter"
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread' },
          ]}
          value={filter}
        />
      ) : null}
      {operationError ? <InlineError message={operationError} /> : null}
      {error && notifications.length > 0 ? <InlineError message={error} /> : null}
    </View>
  );

  if (activeCategory === 'requests') {
    return (
      <AppScreen padding="md">
        <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: 12 }}>
          {header}
          <AppCard padding="md" style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldCheck color={colors.primaryAction} size={20} />
              <AppText variant="label">Workspace approvals</AppText>
            </View>
            <AppText tone="secondary" variant="caption">
              {role === 'manager'
                ? 'Review pending permission requests for this workspace.'
                : 'Review pending join requests, member verifications, and permission requests.'}
            </AppText>
            <AppButton
              accessibilityLabel="Open workspace approvals"
              icon={<ChevronRight color={colors.onPrimary} size={17} />}
              onPress={() => router.push('/approvals')}
              style={{ alignSelf: 'flex-start' }}
            >
              Open approvals
            </AppButton>
          </AppCard>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen padding="md">
      <FlatList
        contentContainerStyle={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          paddingBottom: themeTokens.spacing.lg,
        }}
        data={rows}
        keyExtractor={(item) => item.key}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.45}
        refreshControl={
          <RefreshControl
            onRefresh={refresh}
            refreshing={refreshing}
            tintColor={colors.primaryAction}
            colors={[colors.primaryAction]}
          />
        }
        renderItem={({ item }) =>
          item.kind === 'heading' ? (
            <AppText
              accessibilityRole="header"
              style={{ marginTop: themeTokens.spacing.sm, marginBottom: 4 }}
              tone="secondary"
              variant="caption"
            >
              {item.label}
            </AppText>
          ) : (
            <NotificationRow
              markingRead={markingReadIds.has(item.notification.id)}
              notification={item.notification}
              onMarkRead={() => void markRead(item.notification)}
              onOpen={() => void openNotification(item.notification)}
              opening={openingId === item.notification.id}
            />
          )
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <LoadingState label="Loading notifications" />
          ) : error ? (
            <View style={{ gap: 10, paddingVertical: themeTokens.spacing.md }}>
              <InlineError message={error} />
              <AppButton
                accessibilityLabel="Retry loading notifications"
                onPress={refresh}
                variant="outline"
              >
                Try again
              </AppButton>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 6, paddingVertical: themeTokens.spacing.xl }}>
              <Bell color={colors.textMuted} size={26} />
              <AppText variant="label">
                {filter === 'unread' ? 'No unread notifications' : 'Your Inbox is clear'}
              </AppText>
              <AppText style={{ textAlign: 'center' }} tone="secondary" variant="caption">
                {filter === 'unread'
                  ? 'You are all caught up on unread updates.'
                  : 'Task, project, and workspace updates will appear here.'}
              </AppText>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: themeTokens.spacing.md }}>
              <LoadingState label="Loading more notifications" />
            </View>
          ) : currentPage?.hasMore ? (
            <AppButton
              accessibilityLabel="Load more notifications"
              onPress={() => void loadMore()}
              variant="ghost"
            >
              Load more
            </AppButton>
          ) : undefined
        }
      />
    </AppScreen>
  );
}
