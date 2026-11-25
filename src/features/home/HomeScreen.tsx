import { router, useFocusEffect } from 'expo-router';
import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  FolderKanban,
  ListTodo,
  Plus,
  ShieldAlert,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, RefreshControl, ScrollView, View } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { MainAppHeader } from '../../components/navigation/MainAppHeader';
import { QuickWorkspaceSwitcher } from '../../components/navigation/QuickWorkspaceSwitcher';
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
import { getDueDateLabel, getDueSoonTasks, getNeedsAttentionTasks } from './dashboard-utils';
import { NavigationDrawer } from './NavigationDrawer';
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

function TaskRow({
  task,
  onPress,
}: {
  task: HomeDashboardData['tasks'][number];
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const dueLabel = getDueDateLabel(task.deadline, new Date(), task.status);
  const priority = displayPriority(task.priority);

  return (
    <AppCard
      accessibilityLabel={`Open task ${task.title}`}
      onPress={onPress}
      padding="sm"
      style={{
        gap: themeTokens.spacing.xxs,
        borderWidth: 0,
        backgroundColor: colors.surfaceSubtle,
      }}
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
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [switcherVisible, setSwitcherVisible] = useState(false);
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
  const canCreateTasks =
    workspacePermissionStatus === 'ready' &&
    permissions?.permissions.create_tasks === true &&
    ['owner', 'admin', 'manager', 'member'].includes(permissions.role);
  const edgeSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          !drawerVisible &&
          gesture.x0 < 28 &&
          gesture.dx > 22 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx > 50) setDrawerVisible(true);
        },
      }),
    [drawerVisible],
  );

  useFocusEffect(
    useCallback(() => {
      if (status !== 'authenticated' || workspacePermissionStatus !== 'ready' || !workspaceId) {
        return undefined;
      }

      const controller = new AbortController();
      const requestAttempt = loadAttempt;
      void Promise.resolve()
        .then(() => {
          if (controller.signal.aborted) return undefined;
          setDashboard((current) => (current?.workspaceId === workspaceId ? current : null));
          setLoading(true);
          setErrorState(null);
          return homeService.getDashboardData(workspaceId, controller.signal);
        })
        .then((response) => {
          if (!controller.signal.aborted && requestAttempt === loadAttempt && response) {
            setDashboard(response);
          }
        })
        .catch(async (requestError: unknown) => {
          if (controller.signal.aborted || requestAttempt !== loadAttempt) return;
          try {
            const wasRedirected = await routeForAccessError(requestError, () =>
              logoutRef.current(),
            );
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
          if (!controller.signal.aborted && requestAttempt === loadAttempt) setLoading(false);
        });

      return () => controller.abort();
    }, [loadAttempt, status, workspaceId, workspacePermissionStatus]),
  );

  const retry = () => setLoadAttempt((attempt) => attempt + 1);
  const summary = currentDashboard?.summary;
  const attentionTasks = currentDashboard ? getNeedsAttentionTasks(currentDashboard.tasks) : [];
  const dueSoonTasks = currentDashboard ? getDueSoonTasks(currentDashboard.tasks) : [];
  const quickAccess = [
    ...(canCreateTasks
      ? [{ title: 'Create Task', route: '/task-create' as const, Icon: Plus }]
      : []),
    { title: 'Projects', route: '/(tabs)/projects' as const, Icon: FolderKanban },
  ];

  if (!currentDashboard && (loading || !errorMessage)) {
    return (
      <AppScreen>
        <LoadingState label="Loading your work" variant="fullScreen" />
      </AppScreen>
    );
  }

  return (
    <AppScreen padding="md">
      <View {...edgeSwipeResponder.panHandlers} style={{ flex: 1 }}>
        <MainAppHeader onProfilePress={() => setDrawerVisible(true)} />
        <ScrollView
          contentContainerStyle={{
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
            gap: themeTokens.spacing.md,
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
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          testID="home-scroll-view"
        >
          <AppText accessibilityRole="header" variant="heading">
            Hello, {firstName(user?.firstName)}
          </AppText>

          {errorMessage && (
            <InlineError
              message={errorMessage}
              onRetry={retry}
              retryLabel="Retry loading your work"
            />
          )}

          {summary && (
            <View style={{ gap: themeTokens.spacing.xs }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <AppText accessibilityRole="header" variant="heading">
                  My work
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.xs }}>
                {[
                  {
                    label: 'Assigned to me',
                    value: summary.totalTasks,
                    Icon: ClipboardList,
                    tone: 'info' as const,
                  },
                  {
                    label: 'Open',
                    value: summary.openTasks,
                    Icon: ListTodo,
                    tone: 'neutral' as const,
                  },
                  {
                    label: 'Overdue',
                    value: summary.overdueTasks,
                    Icon: CircleAlert,
                    tone: 'danger' as const,
                  },
                  {
                    label: 'Urgent',
                    value: summary.urgentTasks,
                    Icon: ShieldAlert,
                    tone: 'warning' as const,
                  },
                ].map(({ label, value, Icon, tone }) => (
                  <AppCard
                    accessibilityLabel={`Open Tasks, ${label}: ${value}`}
                    key={label}
                    onPress={() => router.push('/(tabs)/tasks')}
                    padding="sm"
                    style={{
                      flexBasis: '47%',
                      flexGrow: 1,
                      minHeight: 76,
                      gap: themeTokens.spacing.xxs,
                      borderWidth: 0,
                      backgroundColor: colors.surfaceSubtle,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon color={colors.semantic[tone].foreground} size={16} />
                      <AppText numberOfLines={1} tone="secondary" variant="caption">
                        {label}
                      </AppText>
                    </View>
                    <AppText variant="heading">{value}</AppText>
                  </AppCard>
                ))}
              </View>
            </View>
          )}

          {currentDashboard && summary?.totalTasks === 0 && (
            <AppText tone="secondary" variant="caption">
              No tasks assigned yet.
            </AppText>
          )}

          <View style={{ gap: themeTokens.spacing.xs }}>
            <AppText accessibilityRole="header" variant="label">
              Quick access
            </AppText>
            <View style={{ flexDirection: 'row', gap: themeTokens.spacing.xs }}>
              {quickAccess.map(({ title, route, Icon }) => (
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
                    minHeight: 64,
                    borderWidth: 0,
                    backgroundColor: colors.surfaceSubtle,
                  }}
                >
                  <Icon color={colors.primaryAction} size={22} />
                  <AppText variant="label">{title}</AppText>
                </AppCard>
              ))}
            </View>
          </View>

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
                    Needs attention
                  </AppText>
                  <AppButton
                    accessibilityLabel="See all tasks needing attention"
                    onPress={() => router.push('/(tabs)/tasks')}
                    style={{ minHeight: 40, paddingHorizontal: 4 }}
                    variant="ghost"
                  >
                    See all
                  </AppButton>
                </View>
                {attentionTasks.length ? (
                  attentionTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      onPress={() => router.push(`/tasks/${encodeURIComponent(task.id)}`)}
                      task={task}
                    />
                  ))
                ) : (
                  <AppText tone="secondary" variant="caption">
                    Nothing needs attention right now.
                  </AppText>
                )}
              </View>

              <View style={{ gap: themeTokens.spacing.xs }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: themeTokens.spacing.xs,
                  }}
                >
                  <CalendarDays color={colors.primaryAction} size={20} />
                  <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
                    Due soon
                  </AppText>
                  <AppButton
                    accessibilityLabel="See all due soon tasks"
                    onPress={() => router.push('/(tabs)/tasks')}
                    style={{ minHeight: 40, paddingHorizontal: 4 }}
                    variant="ghost"
                  >
                    See all
                  </AppButton>
                </View>
                {dueSoonTasks.length ? (
                  dueSoonTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      onPress={() => router.push(`/tasks/${encodeURIComponent(task.id)}`)}
                      task={task}
                    />
                  ))
                ) : (
                  <AppText tone="secondary" variant="caption">
                    Nothing due in the next 7 days.
                  </AppText>
                )}
              </View>
            </>
          )}
        </ScrollView>
        <NavigationDrawer
          activeDestination="Home"
          onClose={() => setDrawerVisible(false)}
          onNavigate={(route) => router.push(route)}
          onSwitchWorkspace={() => setSwitcherVisible(true)}
          onSignOut={async () => {
            await logout();
            router.replace('/sign-in');
          }}
          user={user}
          visible={drawerVisible}
          workspace={activeWorkspace}
        />
        <QuickWorkspaceSwitcher
          onClose={() => setSwitcherVisible(false)}
          visible={switcherVisible}
        />
      </View>
    </AppScreen>
  );
}
