import { router, useFocusEffect } from 'expo-router';
import { ChevronDown, ListTodo, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { MainAppHeader } from '../../components/navigation/MainAppHeader';
import {
  AppButton,
  AppCard,
  AppScreen,
  AppText,
  BottomSheet,
  InlineError,
  LoadingState,
  UserAvatar,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { getDueDateLabel } from '../home/dashboard-utils';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskListItem,
  type TaskPage,
  type TaskPriority,
  type TaskRelation,
  taskService,
  type TaskStatus,
} from './service';

type StatusFilter = TaskStatus | '';
type PriorityFilter = TaskPriority | '';

interface ScopedTaskPage extends TaskPage {
  workspaceId: string;
  key: string;
}

function labelFor(value: string | null | undefined): string {
  if (!value) return 'Not set';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function requestErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError)
    return 'You appear to be offline. Reconnect and try loading tasks again.';
  if (error instanceof ApiTimeoutError) return 'Loading tasks took too long. Please try again.';
  if (error instanceof ApiError && error.status === 429)
    return 'Too many requests. Wait a moment, then try again.';
  if (error instanceof ApiError && error.status === 403)
    return 'You do not have permission to view these tasks.';
  if (error instanceof ApiError && error.status === 423)
    return 'This workspace is temporarily suspended.';
  return 'Tasks could not be loaded. Please try again.';
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 34,
        justifyContent: 'center',
        borderRadius: themeTokens.radius.pill,
        paddingHorizontal: themeTokens.spacing.sm,
        backgroundColor: selected ? colors.primaryAction : colors.surfaceSubtle,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <AppText tone={selected ? 'inverse' : 'secondary'} variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

function TaskCard({
  task,
  onActions,
  watching,
  open,
  onOpen,
  onClose,
  onWatch,
}: {
  task: TaskListItem;
  onActions: (task: TaskListItem) => void;
  watching: boolean;
  open: boolean;
  onOpen: (taskId: string) => void;
  onClose: (taskId: string) => void;
  onWatch: (task: TaskListItem) => void;
}) {
  const { colors } = useAppTheme();
  const translateX = useMemo(() => new Animated.Value(open ? -252 : 0), [open]);
  useEffect(() => {
    Animated.spring(translateX, {
      toValue: open ? -252 : 0,
      damping: 22,
      stiffness: 260,
      useNativeDriver: true,
    }).start();
  }, [open, translateX]);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
        onPanResponderMove: (_event, gesture) => {
          const base = open ? -252 : 0;
          translateX.setValue(Math.max(-252, Math.min(0, base + gesture.dx)));
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx < -45) onOpen(task.id);
          else if (gesture.dx > 35) onClose(task.id);
          else {
            Animated.spring(translateX, {
              toValue: open ? -252 : 0,
              damping: 22,
              stiffness: 260,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [open, onClose, onOpen, task.id, translateX],
  );
  const dueLabel = getDueDateLabel(task.deadline, new Date(), task.status);
  const related = task.project?.name ?? task.team?.name ?? null;
  const assignees =
    task.assignees && task.assignees.length ? task.assignees : task.assignee ? [task.assignee] : [];
  const assigneeName = (person: NonNullable<typeof assignees>[number]) =>
    [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || 'Assignee';

  return (
    <View style={{ height: 118, overflow: 'hidden', borderRadius: themeTokens.radius.md }}>
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 252,
          flexDirection: 'row',
          backgroundColor: colors.primaryAction,
        }}
      >
        {task.access?.canEdit ? (
          <Pressable
            accessibilityLabel={`Change status for ${task.title}`}
            accessibilityRole="button"
            onPress={() => onActions(task)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}
          >
            <AppText tone="inverse" variant="caption">
              Status
            </AppText>
          </Pressable>
        ) : null}
        {task.access?.canEdit && !task.access.readOnly ? (
          <Pressable
            accessibilityLabel={`Edit ${task.title}`}
            accessibilityRole="button"
            onPress={() => router.push(`/task-edit/${encodeURIComponent(task.id)}`)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppText tone="inverse" variant="caption">
              Edit
            </AppText>
          </Pressable>
        ) : null}
        {task.access?.canView ? (
          <Pressable
            accessibilityLabel={`${watching ? 'Unwatch' : 'Watch'} ${task.title}`}
            accessibilityRole="button"
            onPress={() => onWatch(task)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppText tone="inverse" variant="caption">
              {watching ? 'Unwatch' : 'Watch'}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <Animated.View
        {...responder.panHandlers}
        style={{
          flex: 1,
          transform: [{ translateX }],
        }}
      >
        <AppCard
          accessibilityLabel={`Open task ${task.title}`}
          accessibilityActions={[
            { name: 'activate', label: `Open task actions for ${task.title}` },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'activate') onActions(task);
          }}
          onLongPress={() => onActions(task)}
          onPress={() => router.push(`/tasks/${encodeURIComponent(task.id)}`)}
          padding="sm"
          style={{ height: 118, gap: themeTokens.spacing.xxs, borderWidth: 0 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
            <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
              <AppText numberOfLines={2} variant="label">
                {task.title}
              </AppText>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.xs }}
              >
                <AppText numberOfLines={1} tone="secondary" variant="caption">
                  {labelFor(task.status)}
                </AppText>
                <AppText tone="subtle" variant="caption">
                  ·
                </AppText>
                <AppText numberOfLines={1} tone="secondary" variant="caption">
                  {labelFor(task.priority)}
                </AppText>
              </View>
            </View>
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
          {assignees.length > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {assignees.slice(0, 3).map((person, index) => (
                <View key={person.id} style={{ marginLeft: index === 0 ? 0 : -7 }}>
                  <UserAvatar
                    imageUrl={person.profilePictureUrl}
                    name={assigneeName(person)}
                    size={28}
                  />
                </View>
              ))}
              {assignees.length > 3 ? (
                <AppText tone="secondary" variant="caption" style={{ marginLeft: 6 }}>
                  +{assignees.length - 3}
                </AppText>
              ) : null}
            </View>
          ) : (
            <AppText tone="secondary" variant="caption">
              Unassigned
            </AppText>
          )}
          {related ? (
            <AppText numberOfLines={1} tone="subtle" variant="caption">
              {related}
            </AppText>
          ) : null}
        </AppCard>
      </Animated.View>
    </View>
  );
}

export function TasksScreen() {
  const { activeWorkspace } = useAuth();
  return <TasksScreenContent key={activeWorkspace?.companyId ?? 'no-workspace'} />;
}

function TasksScreenContent() {
  const { activeWorkspace, permissions, status, workspacePermissionStatus, logout, user } =
    useAuth();
  const userId = user?.id;
  const { colors } = useAppTheme();
  const [relation, setRelation] = useState<TaskRelation>('assigned');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('');
  const [draftStatus, setDraftStatus] = useState<StatusFilter>('');
  const [draftPriority, setDraftPriority] = useState<PriorityFilter>('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [actionTask, setActionTask] = useState<TaskListItem | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [statusTask, setStatusTask] = useState<TaskListItem | null>(null);
  const [watchingTaskIds, setWatchingTaskIds] = useState<Set<string>>(new Set());
  const [watchLoadingId, setWatchLoadingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [pageData, setPageData] = useState<ScopedTaskPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const moreRequest = useRef<AbortController | null>(null);
  const workspaceId = activeWorkspace?.companyId ?? null;
  const canViewAllTasks = permissions?.permissions.view_all_tasks === true;
  const activeRelation = relation === 'all' && !canViewAllTasks ? 'assigned' : relation;
  const canCreateTasks =
    workspacePermissionStatus === 'ready' &&
    permissions?.permissions.create_tasks === true &&
    ['owner', 'admin', 'manager', 'member'].includes(permissions.role);
  const isReady =
    status === 'authenticated' &&
    workspacePermissionStatus === 'ready' &&
    Boolean(activeWorkspace && workspaceId);
  const listKey = [
    workspaceId ?? '',
    activeRelation,
    statusFilter,
    priorityFilter,
    debouncedQuery,
  ].join('|');
  const currentPage =
    pageData?.workspaceId === workspaceId && pageData.key === listKey ? pageData : null;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim().slice(0, 100)), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      if (!isReady || !workspaceId) return undefined;
      if (activeRelation === 'all' && !canViewAllTasks) return undefined;

      const controller = new AbortController();
      const requestAttempt = retry;
      activeRequest.current?.abort();
      moreRequest.current?.abort();
      activeRequest.current = controller;
      setLoading(true);
      setLoadingMore(false);
      setError(null);
      void taskService
        .listTasks(
          workspaceId,
          {
            relation: activeRelation,
            page: 1,
            query: debouncedQuery,
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(priorityFilter ? { priority: priorityFilter } : {}),
            canViewAllTasks,
          },
          controller.signal,
        )
        .then((response) => {
          if (controller.signal.aborted || requestAttempt !== retry) return;
          setPageData({ ...response, workspaceId, key: listKey });
        })
        .catch(async (requestError: unknown) => {
          if (controller.signal.aborted || requestAttempt !== retry) return;
          if (requestError instanceof ApiError && requestError.status === 401) {
            try {
              await logout();
              router.replace('/sign-in');
            } catch {
              setError('Your session could not be cleared safely. Please try again.');
            }
            return;
          }
          if (requestError instanceof ApiError && requestError.status === 423) {
            router.replace('/workspace-suspended');
            return;
          }
          setError(requestErrorMessage(requestError));
        })
        .finally(() => {
          if (!controller.signal.aborted && requestAttempt === retry) setLoading(false);
        });

      return () => {
        controller.abort();
        moreRequest.current?.abort();
      };
    }, [
      canViewAllTasks,
      activeRelation,
      debouncedQuery,
      isReady,
      listKey,
      logout,
      priorityFilter,
      statusFilter,
      workspaceId,
      retry,
    ]),
  );

  const loadMore = async () => {
    if (
      !currentPage ||
      loadingMore ||
      currentPage.tasks.length >= currentPage.total ||
      !workspaceId
    )
      return;
    const controller = new AbortController();
    moreRequest.current?.abort();
    moreRequest.current = controller;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await taskService.listTasks(
        workspaceId,
        {
          relation: activeRelation,
          page: currentPage.page + 1,
          query: debouncedQuery,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(priorityFilter ? { priority: priorityFilter } : {}),
          canViewAllTasks,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setPageData((previous) => {
        if (!previous || previous.workspaceId !== workspaceId || previous.key !== listKey) {
          return previous;
        }
        return {
          ...next,
          tasks: [...previous.tasks, ...next.tasks],
          workspaceId,
          key: listKey,
        };
      });
    } catch (requestError) {
      if (!controller.signal.aborted) setError(requestErrorMessage(requestError));
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  };

  if (!isReady) {
    return (
      <AppScreen>
        <LoadingState label="Verifying workspace access" variant="fullScreen" />
      </AppScreen>
    );
  }

  const views: { label: string; value: TaskRelation }[] = [
    { label: 'My Tasks', value: 'assigned' },
    { label: 'Created by Me', value: 'created' },
    ...(canViewAllTasks ? [{ label: 'All Tasks', value: 'all' as const }] : []),
  ];

  const activeFilterCount = Number(Boolean(statusFilter)) + Number(Boolean(priorityFilter));
  const dismissFilters = () => {
    setDraftStatus(statusFilter);
    setDraftPriority(priorityFilter);
    setFiltersVisible(false);
  };
  const emptyLabel =
    query || statusFilter || priorityFilter
      ? 'Try changing your search or filters.'
      : activeRelation === 'assigned'
        ? 'Tasks assigned to you will appear here.'
        : activeRelation === 'created'
          ? 'Tasks you create will appear here.'
          : 'There are no tasks in this workspace.';

  return (
    <AppScreen edges={['right', 'bottom', 'left']} padding="md">
      <MainAppHeader />
      <View style={{ paddingHorizontal: themeTokens.spacing.md, flex: 1 }}>
        <FlatList
          contentContainerStyle={{
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
            gap: themeTokens.spacing.xs,
            paddingBottom: themeTokens.spacing.lg,
          }}
          data={currentPage?.tasks ?? []}
          keyExtractor={(task) => task.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ gap: themeTokens.spacing.sm, marginBottom: themeTokens.spacing.xs }}>
              <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center' }}>
                <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
                  Tasks
                </AppText>
                {canCreateTasks && (
                  <AppButton
                    accessibilityLabel="Create task"
                    icon={<ListTodo color={colors.onPrimary} size={16} />}
                    onPress={() => router.push('/task-create')}
                    style={{ minHeight: 40, minWidth: 104 }}
                    variant="primary"
                  >
                    + Create
                  </AppButton>
                )}
              </View>

              <View
                accessibilityRole="tablist"
                style={{ flexDirection: 'row', gap: themeTokens.spacing.xxs }}
              >
                {views.map((view) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: activeRelation === view.value }}
                    key={view.value}
                    onPress={() => setRelation(view.value)}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 2,
                      borderBottomWidth: activeRelation === view.value ? 2 : 1,
                      borderBottomColor:
                        activeRelation === view.value ? colors.primaryAction : colors.border,
                    }}
                  >
                    <AppText
                      numberOfLines={1}
                      tone={activeRelation === view.value ? 'link' : 'secondary'}
                      variant="caption"
                    >
                      {view.label}
                    </AppText>
                  </Pressable>
                ))}
              </View>

              <View
                style={{
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: themeTokens.radius.md,
                  paddingLeft: themeTokens.spacing.sm,
                  backgroundColor: colors.surface,
                }}
              >
                <Search color={colors.textMuted} size={18} />
                <TextInput
                  accessibilityLabel="Search tasks"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={100}
                  onChangeText={setQuery}
                  placeholder="Search tasks"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="search"
                  style={{
                    flex: 1,
                    minHeight: 42,
                    color: colors.text,
                    paddingHorizontal: themeTokens.spacing.sm,
                    fontSize: 16,
                  }}
                  testID="task-search-input"
                  value={query}
                />
                {query.length > 0 && (
                  <Pressable
                    accessibilityLabel="Clear task search"
                    accessibilityRole="button"
                    onPress={() => setQuery('')}
                    style={{
                      minWidth: 42,
                      minHeight: 42,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X color={colors.textMuted} size={18} />
                  </Pressable>
                )}
              </View>

              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.xs }}
              >
                <Pressable
                  accessibilityLabel={`Status: ${statusFilter ? labelFor(statusFilter) : 'Any'}`}
                  accessibilityRole="button"
                  onPress={() => {
                    setDraftStatus(statusFilter);
                    setDraftPriority(priorityFilter);
                    setFiltersVisible(true);
                  }}
                  style={{
                    minHeight: 36,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: themeTokens.spacing.sm,
                    borderRadius: themeTokens.radius.pill,
                    backgroundColor: colors.surfaceSubtle,
                  }}
                >
                  <AppText numberOfLines={1} variant="caption">
                    {statusFilter ? labelFor(statusFilter) : 'Any status'}
                  </AppText>
                  <ChevronDown color={colors.textMuted} size={14} />
                </Pressable>
                <Pressable
                  accessibilityLabel={`Priority: ${priorityFilter ? labelFor(priorityFilter) : 'Any'}`}
                  accessibilityRole="button"
                  onPress={() => {
                    setDraftStatus(statusFilter);
                    setDraftPriority(priorityFilter);
                    setFiltersVisible(true);
                  }}
                  style={{
                    minHeight: 36,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: themeTokens.spacing.sm,
                    borderRadius: themeTokens.radius.pill,
                    backgroundColor: colors.surfaceSubtle,
                  }}
                >
                  <AppText numberOfLines={1} variant="caption">
                    {priorityFilter ? labelFor(priorityFilter) : 'Any priority'}
                  </AppText>
                  <ChevronDown color={colors.textMuted} size={14} />
                </Pressable>
                <Pressable
                  accessibilityLabel={`Filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`}
                  accessibilityRole="button"
                  onPress={() => {
                    setDraftStatus(statusFilter);
                    setDraftPriority(priorityFilter);
                    setFiltersVisible(true);
                  }}
                  style={{
                    minHeight: 40,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: themeTokens.spacing.xs,
                  }}
                >
                  <SlidersHorizontal color={colors.primaryAction} size={17} />
                  <AppText tone="link" variant="caption">
                    Filters{activeFilterCount ? ` ${activeFilterCount}` : ''}
                  </AppText>
                </Pressable>
              </View>

              <AppText tone="secondary" variant="caption">
                {currentPage
                  ? `${currentPage.total} ${currentPage.total === 1 ? 'task' : 'tasks'}`
                  : 'Tasks'}
              </AppText>
              {error && (
                <InlineError
                  message={error}
                  onRetry={() => setRetry((value) => value + 1)}
                  retryLabel="Retry loading tasks"
                />
              )}
              {loading && !currentPage ? <LoadingState label="Loading tasks" /> : null}
            </View>
          }
          ListEmptyComponent={
            !loading && !error && currentPage ? (
              <View
                style={{ alignItems: 'center', gap: themeTokens.spacing.xs, paddingVertical: 24 }}
              >
                <AppText variant="label">No tasks found</AppText>
                <AppText style={{ textAlign: 'center' }} tone="secondary">
                  {emptyLabel}
                </AppText>
              </View>
            ) : undefined
          }
          ListFooterComponent={
            currentPage && currentPage.tasks.length > 0 ? (
              <View style={{ gap: themeTokens.spacing.xs, paddingTop: themeTokens.spacing.sm }}>
                {currentPage.tasks.length < currentPage.total && (
                  <AppButton
                    accessibilityLabel="Load more tasks"
                    loading={loadingMore}
                    onPress={() => void loadMore()}
                    variant="outline"
                  >
                    Load more
                  </AppButton>
                )}
                <AppText
                  accessibilityLiveRegion="polite"
                  style={{ textAlign: 'center' }}
                  tone="subtle"
                  variant="caption"
                >
                  Showing {currentPage.tasks.length} of {currentPage.total} tasks
                </AppText>
              </View>
            ) : undefined
          }
          refreshControl={
            <RefreshControl
              colors={[colors.primaryAction]}
              onRefresh={() => setRetry((value) => value + 1)}
              refreshing={loading && Boolean(currentPage)}
              tintColor={colors.primaryAction}
            />
          }
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              watching={watchingTaskIds.has(item.id)}
              open={openTaskId === item.id}
              onClose={(taskId) =>
                setOpenTaskId((current) => (current === taskId ? null : current))
              }
              onOpen={(taskId) => {
                setOpenTaskId(taskId);
                if (!workspaceId) return;
                void taskService
                  .getWatchers(taskId, workspaceId)
                  .then((watchers) => {
                    setWatchingTaskIds((current) => {
                      const next = new Set(current);
                      if (watchers.some((watcher) => watcher.id === userId)) next.add(taskId);
                      else next.delete(taskId);
                      return next;
                    });
                  })
                  .catch(() => undefined);
              }}
              onActions={(selected) => {
                setOpenTaskId(selected.id);
                setActionTask(selected);
                if (workspaceId) {
                  void taskService
                    .getWatchers(selected.id, workspaceId)
                    .then((watchers) => {
                      setWatchingTaskIds((current) => {
                        const next = new Set(current);
                        if (watchers.some((watcher) => watcher.id === userId))
                          next.add(selected.id);
                        else next.delete(selected.id);
                        return next;
                      });
                    })
                    .catch(() => undefined);
                }
              }}
              onWatch={(selected) => {
                if (!workspaceId) return;
                setWatchLoadingId(selected.id);
                const isWatching = watchingTaskIds.has(selected.id);
                void (async () => {
                  try {
                    if (isWatching) await taskService.unwatchTask(selected.id, workspaceId);
                    else await taskService.watchTask(selected.id, workspaceId);
                    setWatchingTaskIds((current) => {
                      const next = new Set(current);
                      if (isWatching) next.delete(selected.id);
                      else next.add(selected.id);
                      return next;
                    });
                    setOpenTaskId(null);
                  } catch (watchError) {
                    setError(
                      watchError instanceof ApiError && watchError.status === 403
                        ? 'You do not have permission to watch this task.'
                        : 'The watch state could not be changed. Please try again.',
                    );
                  } finally {
                    setWatchLoadingId(null);
                  }
                })();
              }}
            />
          )}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          testID="tasks-list"
        />
      </View>
      <BottomSheet
        onClose={() => setActionTask(null)}
        testID="task-actions-sheet"
        title={actionTask?.title ?? 'Task actions'}
        visible={Boolean(actionTask)}
      >
        {actionTask ? (
          <View style={{ gap: themeTokens.spacing.sm, paddingBottom: themeTokens.spacing.sm }}>
            {actionTask.access?.canEdit ? (
              <AppButton
                accessibilityLabel="Change task status"
                onPress={() => {
                  setStatusTask(actionTask);
                  setActionTask(null);
                }}
                variant="outline"
              >
                Change status
              </AppButton>
            ) : null}
            {actionTask.access?.canEdit && !actionTask.access.readOnly ? (
              <AppButton
                accessibilityLabel="Edit task"
                onPress={() => {
                  setActionTask(null);
                  router.push(`/task-edit/${encodeURIComponent(actionTask.id)}`);
                }}
                variant="outline"
              >
                Edit task
              </AppButton>
            ) : null}
            {actionTask.access?.canView ? (
              <AppButton
                accessibilityLabel={
                  watchingTaskIds.has(actionTask.id) ? 'Unwatch task' : 'Watch task'
                }
                disabled={watchLoadingId === actionTask.id}
                loading={watchLoadingId === actionTask.id}
                onPress={async () => {
                  if (!workspaceId) return;
                  const isWatching = watchingTaskIds.has(actionTask.id);
                  setWatchLoadingId(actionTask.id);
                  try {
                    if (isWatching) {
                      await taskService.unwatchTask(actionTask.id, workspaceId);
                      setWatchingTaskIds((current) => {
                        const next = new Set(current);
                        next.delete(actionTask.id);
                        return next;
                      });
                    } else {
                      await taskService.watchTask(actionTask.id, workspaceId);
                      setWatchingTaskIds((current) => new Set(current).add(actionTask.id));
                    }
                    setActionTask(null);
                    setOpenTaskId(null);
                  } catch (watchError) {
                    setError(
                      watchError instanceof ApiError && watchError.status === 403
                        ? 'You do not have permission to watch this task.'
                        : 'The watch state could not be changed. Please try again.',
                    );
                  } finally {
                    setWatchLoadingId(null);
                  }
                }}
                variant="outline"
              >
                {watchingTaskIds.has(actionTask.id) ? 'Unwatch' : 'Watch'}
              </AppButton>
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
      <BottomSheet
        onClose={() => setStatusTask(null)}
        testID="task-status-sheet"
        title="Change status"
        visible={Boolean(statusTask)}
      >
        {statusTask ? (
          <View style={{ gap: themeTokens.spacing.sm, paddingBottom: themeTokens.spacing.sm }}>
            {TASK_STATUSES.filter(
              (candidate) =>
                candidate !== statusTask.status &&
                !(statusTask.status === 'in_review' && candidate === 'completed'),
            ).map((candidate) => (
              <AppButton
                accessibilityLabel={`Set status to ${labelFor(candidate)}`}
                disabled={watchLoadingId === statusTask.id}
                key={candidate}
                onPress={async () => {
                  if (!workspaceId || !statusTask.access) return;
                  setWatchLoadingId(statusTask.id);
                  setError(null);
                  try {
                    const updated = await taskService.updateTask(
                      statusTask.id,
                      workspaceId,
                      { status: candidate },
                      statusTask.access,
                    );
                    setPageData((previous) =>
                      previous
                        ? {
                            ...previous,
                            tasks: previous.tasks.map((task) =>
                              task.id === updated.id ? { ...task, ...updated } : task,
                            ),
                          }
                        : previous,
                    );
                    setStatusTask(null);
                    setOpenTaskId(null);
                  } catch (statusError) {
                    setError(
                      statusError instanceof ApiError &&
                        [400, 403, 409].includes(statusError.status)
                        ? 'The server rejected this status change. The task was not changed.'
                        : 'The status could not be updated. Please try again.',
                    );
                  } finally {
                    setWatchLoadingId(null);
                  }
                }}
                variant="outline"
              >
                {labelFor(candidate)}
              </AppButton>
            ))}
          </View>
        ) : null}
      </BottomSheet>
      <BottomSheet
        footer={
          <View
            style={{
              flexDirection: 'row',
              gap: themeTokens.spacing.sm,
              paddingTop: themeTokens.spacing.md,
            }}
          >
            <AppButton
              accessibilityLabel="Reset task filters"
              onPress={() => {
                setDraftStatus('');
                setDraftPriority('');
              }}
              style={{ flex: 1 }}
              variant="outline"
            >
              Reset
            </AppButton>
            <AppButton
              accessibilityLabel="Apply task filters"
              onPress={() => {
                setStatusFilter(draftStatus);
                setPriorityFilter(draftPriority);
                setFiltersVisible(false);
              }}
              style={{ flex: 1 }}
              variant="primary"
            >
              Apply Filters
            </AppButton>
          </View>
        }
        onClose={dismissFilters}
        testID="task-filter-sheet"
        title="Filters"
        visible={filtersVisible}
      >
        <View style={{ gap: themeTokens.spacing.md }}>
          <View style={{ gap: themeTokens.spacing.xs }}>
            <AppText variant="label">Status</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.xs }}>
              <FilterChip label="Any" onPress={() => setDraftStatus('')} selected={!draftStatus} />
              {TASK_STATUSES.map((value) => (
                <FilterChip
                  key={value}
                  label={labelFor(value)}
                  onPress={() => setDraftStatus(value)}
                  selected={draftStatus === value}
                />
              ))}
            </View>
          </View>
          <View style={{ gap: themeTokens.spacing.xs }}>
            <AppText variant="label">Priority</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.xs }}>
              <FilterChip
                label="Any"
                onPress={() => setDraftPriority('')}
                selected={!draftPriority}
              />
              {TASK_PRIORITIES.map((value) => (
                <FilterChip
                  key={value}
                  label={labelFor(value)}
                  onPress={() => setDraftPriority(value)}
                  selected={draftPriority === value}
                />
              ))}
            </View>
          </View>
        </View>
      </BottomSheet>
    </AppScreen>
  );
}
