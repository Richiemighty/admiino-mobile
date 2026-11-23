import { router } from 'expo-router';
import {
  ArrowRightLeft,
  CalendarDays,
  ChevronRight,
  FolderKanban,
  Inbox,
  ListTodo,
  Search,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import {
  AppButton,
  AppCard,
  AppScreen,
  AppText,
  IconButton,
  InlineError,
  LoadingState,
  UserAvatar,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { getDueDateLabel, getDueSoonTasks, getNeedsAttentionTasks } from './dashboard-utils';
import { type HomeDashboardData, homeService } from './service';

function firstName(value: string | undefined): string {
  return value?.trim().split(/\s+/)[0] || 'there';
}

function displayStatus(value: string | null): string {
  return value
    ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Open';
}

function displayPriority(value: string | null): string | null {
  return value ? value.replace(/\b\w/g, (letter) => letter.toUpperCase()) : null;
}

function requestErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError)
    return 'You appear to be offline. Reconnect and try loading your work again.';
  if (error instanceof ApiTimeoutError) return 'Loading your work took too long. Please try again.';
  if (error instanceof ApiError && error.status === 429)
    return 'Too many requests. Wait a moment, then try again.';
  return 'Your work could not be loaded. Please try again.';
}

async function routeForAccessError(error: unknown, logout: () => Promise<void>): Promise<boolean> {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 401) {
    await logout();
    router.replace('/sign-in');
    return true;
  }
  if (error.status === 403) {
    router.replace('/workspace-access');
    return true;
  }
  if (error.status === 423) {
    router.replace('/workspace-suspended');
    return true;
  }
  return false;
}

function openTaskDestination(title: string) {
  Alert.alert(
    'Task details are not available yet',
    `"${title}" is in your workspace. Open the Tasks tab for its current availability.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Tasks', onPress: () => router.push('/(tabs)/tasks') },
    ],
  );
}

function TaskRow({
  task,
  onPress,
}: {
  task: HomeDashboardData['tasks'][number];
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const dueLabel = getDueDateLabel(task.deadline);
  const priority = displayPriority(task.priority);

  return (
    <AppCard
      accessibilityLabel={`Open task ${task.title}`}
      onPress={onPress}
      padding="sm"
      style={{ gap: themeTokens.spacing.xxs }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
        <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
          <AppText numberOfLines={2} variant="label">
            {task.title}
          </AppText>
          <AppText tone="secondary" variant="caption">
            {displayStatus(task.status)}
            {priority ? ` · ${priority}` : ''}
          </AppText>
        </View>
        <ChevronRight color={colors.textMuted} size={18} />
      </View>
      {dueLabel && (
        <AppText
          accessibilityLabel={`Due ${dueLabel}`}
          tone={dueLabel === 'Overdue' ? 'danger' : 'secondary'}
          variant="caption"
        >
          {dueLabel}
        </AppText>
      )}
    </AppCard>
  );
}

export function HomeScreen() {
  const { user, activeWorkspace, permissions, status, workspacePermissionStatus, logout } =
    useAuth();
  const { colors } = useAppTheme();
  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);
  const [dashboard, setDashboard] = useState<HomeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ workspaceId: string; message: string } | null>(
    null,
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const workspaceId = activeWorkspace?.companyId ?? null;
  const currentDashboard = dashboard?.workspaceId === workspaceId ? dashboard : null;
  const errorMessage = errorState?.workspaceId === workspaceId ? errorState.message : null;

  useEffect(() => {
    if (status !== 'authenticated' || workspacePermissionStatus !== 'ready' || !workspaceId) {
      return;
    }

    const controller = new AbortController();
    void Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return undefined;
        setDashboard((current) => (current?.workspaceId === workspaceId ? current : null));
        setLoading(true);
        setErrorState(null);
        return homeService.getDashboardData(workspaceId, controller.signal);
      })
      .then((response) => {
        if (!controller.signal.aborted && response) setDashboard(response);
      })
      .catch(async (requestError: unknown) => {
        if (controller.signal.aborted) return;
        try {
          const wasRedirected = await routeForAccessError(requestError, () => logoutRef.current());
          if (!wasRedirected) {
            setErrorState({ workspaceId, message: requestErrorMessage(requestError) });
          }
        } catch {
          setErrorState({
            workspaceId,
            message: 'Your session could not be cleared safely. Please try again.',
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [loadAttempt, status, workspaceId, workspacePermissionStatus]);

  const retry = () => setLoadAttempt((attempt) => attempt + 1);
  const summary = currentDashboard?.summary;
  const attentionTasks = currentDashboard ? getNeedsAttentionTasks(currentDashboard.tasks) : [];
  const dueSoonTasks = currentDashboard ? getDueSoonTasks(currentDashboard.tasks) : [];
  const role = permissions?.role
    ? permissions.role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Membership verified';
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.email ||
    'Admiino user';

  if (!currentDashboard && (loading || !errorMessage)) {
    return (
      <AppScreen>
        <LoadingState label="Loading your work" variant="fullScreen" />
      </AppScreen>
    );
  }

  return (
    <AppScreen padding="xl">
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          gap: themeTokens.spacing.lg,
          paddingBottom: themeTokens.spacing.lg,
        }}
        refreshControl={
          <RefreshControl
            colors={[colors.primaryAction]}
            onRefresh={retry}
            refreshing={loading && Boolean(currentDashboard)}
            tintColor={colors.primaryAction}
          />
        }
        testID="home-scroll-view"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
          <View style={{ flex: 1, gap: themeTokens.spacing.xs }}>
            <AppText accessibilityRole="header" variant="heading">
              Hello, {firstName(user?.firstName)}
            </AppText>
            <AppButton
              accessibilityLabel={`Switch workspace from ${activeWorkspace?.company.name ?? 'current workspace'}`}
              icon={<ArrowRightLeft color={colors.primaryAction} size={16} />}
              onPress={() => router.push('/workspace-select')}
              style={{ alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 10 }}
              variant="ghost"
            >
              {activeWorkspace?.company.name ?? 'Choose workspace'}
            </AppButton>
          </View>
          <IconButton
            accessibilityLabel="Open Global Search"
            icon={<Search color={colors.text} size={22} />}
            onPress={() => router.push('/search')}
          />
          <UserAvatar name={displayName} />
        </View>

        {errorMessage && (
          <InlineError
            message={errorMessage}
            onRetry={retry}
            retryLabel="Retry loading your work"
          />
        )}

        {summary && (
          <View style={{ gap: themeTokens.spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}
            >
              <AppText accessibilityRole="header" variant="heading">
                My work
              </AppText>
              <AppText tone="secondary" variant="caption">
                {role}
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.sm }}>
              {[
                { label: 'Assigned to me', value: summary.totalTasks },
                { label: 'Open', value: summary.openTasks },
                { label: 'Overdue', value: summary.overdueTasks },
                { label: 'Urgent', value: summary.urgentTasks },
              ].map((metric) => (
                <AppCard
                  accessibilityLabel={`Open Tasks, ${metric.label}: ${metric.value}`}
                  key={metric.label}
                  onPress={() => router.push('/(tabs)/tasks')}
                  padding="sm"
                  style={{ flexBasis: '47%', flexGrow: 1, gap: themeTokens.spacing.xxs }}
                >
                  <AppText tone="secondary" variant="caption">
                    {metric.label}
                  </AppText>
                  <AppText variant="heading">{metric.value}</AppText>
                </AppCard>
              ))}
            </View>
          </View>
        )}

        {currentDashboard && summary?.totalTasks === 0 && (
          <AppCard padding="md" style={{ gap: themeTokens.spacing.xs }}>
            <AppText variant="label">Nothing assigned yet</AppText>
            <AppText tone="secondary">Tasks assigned to you will appear here.</AppText>
          </AppCard>
        )}

        {currentDashboard && summary && summary.totalTasks > 0 && (
          <>
            <View style={{ gap: themeTokens.spacing.sm }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <AppText accessibilityRole="header" variant="heading">
                  Needs my attention
                </AppText>
                <AppButton
                  accessibilityLabel="Open Tasks"
                  onPress={() => router.push('/(tabs)/tasks')}
                  style={{ minHeight: 40, paddingHorizontal: 8 }}
                  variant="ghost"
                >
                  Tasks
                </AppButton>
              </View>
              {attentionTasks.length ? (
                attentionTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    onPress={() => openTaskDestination(task.title)}
                    task={task}
                  />
                ))
              ) : (
                <AppText tone="secondary">
                  No overdue, high-priority, or near-due tasks are showing in this task list.
                </AppText>
              )}
            </View>

            <View style={{ gap: themeTokens.spacing.sm }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.xs }}
              >
                <CalendarDays color={colors.primaryAction} size={20} />
                <AppText accessibilityRole="header" variant="heading">
                  Due soon
                </AppText>
              </View>
              {dueSoonTasks.length ? (
                dueSoonTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    onPress={() => openTaskDestination(task.title)}
                    task={task}
                  />
                ))
              ) : (
                <AppText tone="secondary">
                  No assigned tasks due in the next 7 days are showing in this task list.
                </AppText>
              )}
            </View>
          </>
        )}

        <View style={{ gap: themeTokens.spacing.sm }}>
          <AppText accessibilityRole="header" variant="heading">
            Quick access
          </AppText>
          <View style={{ flexDirection: 'row', gap: themeTokens.spacing.sm }}>
            {(
              [
                { title: 'Tasks', route: '/(tabs)/tasks', Icon: ListTodo },
                { title: 'Projects', route: '/(tabs)/projects', Icon: FolderKanban },
                { title: 'Inbox', route: '/(tabs)/inbox', Icon: Inbox },
              ] as const
            ).map(({ title, route, Icon }) => (
              <AppCard
                accessibilityLabel={`Open ${title}`}
                key={title}
                onPress={() => router.push(route)}
                padding="sm"
                style={{
                  alignItems: 'center',
                  flex: 1,
                  gap: themeTokens.spacing.xs,
                  justifyContent: 'center',
                  minHeight: 84,
                }}
              >
                <Icon color={colors.primaryAction} size={22} />
                <AppText variant="label">{title}</AppText>
              </AppCard>
            ))}
          </View>
        </View>
      </ScrollView>
    </AppScreen>
  );
}
