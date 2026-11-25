import { router, useFocusEffect } from 'expo-router';
import {
  ChevronDown,
  CircleDot,
  Eye,
  EyeOff,
  ListTodo,
  Pencil,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
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
import { cacheKeys } from '../../data/cacheKeys';
import { cachePolicy, serverCache } from '../../data/serverCache';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { getDueDateLabel } from '../home/dashboard-utils';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskAccess,
  type TaskDetails,
  type TaskListItem,
  type TaskPage,
  type TaskPerson,
  type TaskPriority,
  type TaskRelation,
  taskService,
  type TaskStatus,
} from './service';
import { type TaskPrefetchPriority, TaskPrefetchQueue } from './taskPrefetchQueue';
import { getTaskSwipeActions, getTaskSwipeRevealWidth } from './taskSwipe';

type StatusFilter = TaskStatus | '';
type PriorityFilter = TaskPriority | '';

interface ScopedTaskPage extends TaskPage {
  workspaceId: string;
  key: string;
}

function mergeTaskPages(
  previous: ScopedTaskPage | undefined,
  next: ScopedTaskPage,
): ScopedTaskPage {
  if (!previous || previous.key !== next.key) return next;
  const seen = new Set(next.tasks.map((task) => task.id));
  const retained = previous.tasks.slice(next.tasks.length).filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
  return { ...next, tasks: [...next.tasks, ...retained].slice(0, next.total) };
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

function isTransientTaskAccessError(error: unknown): boolean {
  return (
    error instanceof ApiNetworkError ||
    error instanceof ApiTimeoutError ||
    (error instanceof ApiError && (error.status === 429 || error.status >= 500))
  );
}

function traceTaskAccess(
  taskId: string,
  operation: 'access' | 'watchers',
  outcome: 'confirmed' | 'denied' | 'failed' | 'retrying',
  error?: unknown,
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.info('[Admiino task access]', {
    taskId,
    operation,
    outcome,
    status: error instanceof ApiError ? error.status : null,
  });
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

function StatusBadge({ status }: { status: TaskStatus | null }) {
  const { colors } = useAppTheme();
  const tone = status ? themeTokens.taskStatusTone[status] : 'neutral';
  return (
    <View
      style={{
        flexShrink: 0,
        borderRadius: themeTokens.radius.pill,
        backgroundColor: colors.semantic[tone].background,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <AppText tone={tone === 'neutral' ? 'secondary' : tone} variant="caption">
        {labelFor(status)}
      </AppText>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority | null }) {
  const { colors } = useAppTheme();
  const tone = themeTokens.taskPriorityTone[priority ?? 'medium'];
  return (
    <View
      style={{
        borderRadius: themeTokens.radius.pill,
        backgroundColor: colors.semantic[tone].background,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <AppText tone={tone === 'neutral' ? 'secondary' : tone} variant="caption">
        {labelFor(priority)} priority
      </AppText>
    </View>
  );
}

function TaskCard({
  task,
  onActions,
  watching,
  onOpen,
  onClose,
  onWatch,
  watchKnown,
  watchLoading,
}: {
  task: TaskListItem;
  onActions: (task: TaskListItem) => void;
  watching: boolean;
  onOpen: (taskId: string, methods: SwipeableMethods) => void;
  onClose: (taskId: string) => void;
  onWatch: (task: TaskListItem) => void;
  watchKnown: boolean;
  watchLoading: boolean;
}) {
  const { colors } = useAppTheme();
  const swipeableRef = useRef<SwipeableMethods | null>(null);
  const swipeActions = getTaskSwipeActions(task.access);
  const revealWidth = getTaskSwipeRevealWidth(task.access);
  const canOpenActions = swipeActions.length > 0;
  const dueLabel = getDueDateLabel(task.deadline, new Date(), task.status);
  const related = task.project?.name ?? task.team?.name ?? null;
  const assignees =
    task.assignees && task.assignees.length ? task.assignees : task.assignee ? [task.assignee] : [];
  const assigneeName = (person: NonNullable<typeof assignees>[number]) =>
    [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || 'Assignee';

  return (
    <View style={{ minHeight: 112, overflow: 'hidden', borderRadius: themeTokens.radius.md }}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        dragOffsetFromRight={-16}
        friction={1.2}
        overshootRight={false}
        renderRightActions={(_progress, _translation, methods) => {
          swipeableRef.current = methods;
          if (!canOpenActions) return null;
          return (
            <View style={{ width: revealWidth, flexDirection: 'row' }}>
              {task.access?.canEdit ? (
                <Pressable
                  accessibilityLabel={`Change status for ${task.title}`}
                  accessibilityRole="button"
                  onPress={() => {
                    methods.close();
                    onActions(task);
                  }}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    paddingHorizontal: 4,
                    backgroundColor: colors.primarySurface,
                  }}
                >
                  <CircleDot color={colors.primaryAction} size={19} />
                  <AppText tone="link" variant="caption">
                    Status
                  </AppText>
                </Pressable>
              ) : null}
              {task.access?.canEdit && !task.access.readOnly ? (
                <Pressable
                  accessibilityLabel={`Edit ${task.title}`}
                  accessibilityRole="button"
                  onPress={() => {
                    methods.close();
                    router.push(`/task-edit/${encodeURIComponent(task.id)}`);
                  }}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    backgroundColor: colors.surfaceSubtle,
                  }}
                >
                  <Pencil color={colors.text} size={18} />
                  <AppText variant="caption">Edit</AppText>
                </Pressable>
              ) : null}
              {task.access?.canView ? (
                <Pressable
                  accessibilityLabel={
                    watchKnown
                      ? `${watching ? 'Unwatch' : 'Watch'} ${task.title}`
                      : `Watch status unavailable for ${task.title}`
                  }
                  accessibilityRole="button"
                  disabled={!watchKnown || watchLoading}
                  onPress={() => {
                    if (watchKnown && !watchLoading) {
                      methods.close();
                      onWatch(task);
                    }
                  }}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    backgroundColor: colors.primarySurface,
                  }}
                >
                  {watchLoading ? (
                    <ActivityIndicator color={colors.primaryAction} size="small" />
                  ) : watching ? (
                    <EyeOff color={colors.primaryAction} size={18} />
                  ) : (
                    <Eye color={colors.primaryAction} size={18} />
                  )}
                  <AppText tone="link" variant="caption">
                    {watching ? 'Unwatch' : 'Watch'}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          );
        }}
        onSwipeableClose={(direction) => {
          if (direction === SwipeDirection.LEFT) onClose(task.id);
        }}
        onSwipeableOpen={(direction) => {
          if (canOpenActions && direction === SwipeDirection.LEFT && swipeableRef.current) {
            onOpen(task.id, swipeableRef.current);
          }
        }}
        testID={`task-swipeable-${task.id}`}
      >
        <AppCard
          accessibilityLabel={`Open task ${task.title}`}
          accessibilityActions={
            canOpenActions
              ? [{ name: 'activate', label: `Open task actions for ${task.title}` }]
              : []
          }
          onAccessibilityAction={(event) => {
            if (canOpenActions && event.nativeEvent.actionName === 'activate') onActions(task);
          }}
          onLongPress={() => {
            if (canOpenActions) onActions(task);
          }}
          onPress={() => router.push(`/tasks/${encodeURIComponent(task.id)}`)}
          padding="sm"
          style={{
            gap: themeTokens.spacing.xxs,
            borderWidth: 0,
            paddingVertical: themeTokens.spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: themeTokens.spacing.sm,
            }}
          >
            <AppText numberOfLines={2} style={{ flex: 1 }} variant="label">
              {task.title}
            </AppText>
            <StatusBadge status={task.status} />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: themeTokens.spacing.xs,
              flexWrap: 'wrap',
            }}
          >
            <PriorityBadge priority={task.priority} />
            {dueLabel ? (
              <AppText
                accessibilityLabel={`Due ${dueLabel}`}
                tone={dueLabel === 'Overdue' ? 'danger' : 'secondary'}
                variant="caption"
              >
                {dueLabel}
              </AppText>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
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
              <AppText numberOfLines={1} style={{ flex: 1 }} tone="subtle" variant="caption">
                {related}
              </AppText>
            ) : null}
          </View>
        </AppCard>
      </ReanimatedSwipeable>
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
  const [, setOpenTaskId] = useState<string | null>(null);
  const [statusTask, setStatusTask] = useState<TaskListItem | null>(null);
  const [watchingTaskIds, setWatchingTaskIds] = useState<Set<string>>(new Set());
  const [watchStateByTask, setWatchStateByTask] = useState<Record<string, boolean | null>>({});
  const [taskAccessById, setTaskAccessById] = useState<Record<string, TaskAccess>>({});
  const [watchLoadingId, setWatchLoadingId] = useState<string | null>(null);
  const openSwipeable = useRef<{ taskId: string; methods: SwipeableMethods } | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [pageData, setPageData] = useState<ScopedTaskPage | null>(null);
  const [visibleTaskIds, setVisibleTaskIds] = useState<string[]>([]);
  const accessPrefetchContext = useRef<{
    key: string;
    active: boolean;
    requested: Set<string>;
    cooldownUntil: Map<string, number>;
    queue: TaskPrefetchQueue;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const moreRequest = useRef<AbortController | null>(null);
  const lastLoadedListKey = useRef<string | null>(null);
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
  const tasksCacheKey =
    userId && workspaceId ? cacheKeys.tasks(userId, workspaceId, listKey) : null;
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
      const previousListKey = lastLoadedListKey.current;
      lastLoadedListKey.current = listKey;
      const cached = tasksCacheKey ? serverCache.get<ScopedTaskPage>(tasksCacheKey) : undefined;
      if (cached && cached.workspaceId === workspaceId && cached.key === listKey) {
        setPageData(cached);
        setLoading(false);
        if (
          previousListKey === listKey &&
          serverCache.isFresh(tasksCacheKey ?? '', cachePolicy.taskList) &&
          retry === 0
        ) {
          return () => controller.abort();
        }
      } else {
        setLoading(true);
      }
      setLoadingMore(false);
      if (!cached) setError(null);
      const requestPage = () =>
        taskService.listTasks(
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
        );
      void (
        tasksCacheKey
          ? serverCache.fetch(tasksCacheKey, requestPage, {
              staleTime: cachePolicy.taskList,
              force: retry > 0 || previousListKey !== listKey,
            })
          : requestPage()
      )
        .then((response) => {
          if (controller.signal.aborted || requestAttempt !== retry) return;
          const nextPage = mergeTaskPages(
            tasksCacheKey ? serverCache.get<ScopedTaskPage>(tasksCacheKey) : undefined,
            { ...response, workspaceId, key: listKey },
          );
          if (tasksCacheKey) serverCache.set(tasksCacheKey, nextPage);
          setPageData(nextPage);
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
          if (!cached) setError(requestErrorMessage(requestError));
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
      tasksCacheKey,
    ]),
  );

  useEffect(() => {
    if (!workspaceId || !userId || !currentPage?.tasks.length) return undefined;
    const contextKey = `${workspaceId}:${userId}:${listKey}`;
    if (accessPrefetchContext.current?.key !== contextKey) {
      if (accessPrefetchContext.current) accessPrefetchContext.current.active = false;
      accessPrefetchContext.current = {
        key: contextKey,
        active: true,
        requested: new Set(),
        cooldownUntil: new Map(),
        queue: new TaskPrefetchQueue(3),
      };
    }
    const context = accessPrefetchContext.current;
    const visibleTaskIdSet = new Set(visibleTaskIds);
    const priorityFor = (taskId: string): TaskPrefetchPriority =>
      visibleTaskIdSet.has(taskId) ? 'visible' : 'lookahead';
    const visibleIndexes = visibleTaskIds
      .map((id) => currentPage.tasks.findIndex((task) => task.id === id))
      .filter((index) => index >= 0);
    const start = visibleIndexes.length ? Math.min(...visibleIndexes) : 0;
    const visibleTasks = currentPage.tasks.slice(
      start,
      Math.min(currentPage.tasks.length, start + 16),
    );
    const applyWatcherState = (taskId: string, watchers: TaskPerson[]) => {
      if (!context.active || accessPrefetchContext.current !== context) return;
      const watching = watchers.some((watcher) => watcher.id === userId);
      setWatchStateByTask((current) => ({ ...current, [taskId]: watching }));
      setWatchingTaskIds((current) => {
        const next = new Set(current);
        if (watching) next.add(taskId);
        else next.delete(taskId);
        return next;
      });
    };
    const scheduleAccess = (task: TaskListItem, attempt = 0) => {
      const requestKey = `access:${task.id}`;
      const cooldown = context.cooldownUntil.get(requestKey) ?? 0;
      if (cooldown > Date.now()) return;
      if (cooldown) context.cooldownUntil.delete(requestKey);
      if (!context.active || context.requested.has(requestKey)) return;
      context.requested.add(requestKey);
      const accessKey = cacheKeys.task(userId, workspaceId, task.id);
      const cached = serverCache.get<TaskDetails>(accessKey);
      context.queue.enqueue({
        key: requestKey,
        priority: priorityFor(task.id),
        run: async () => {
          try {
            const access =
              task.access || (cached && serverCache.isFresh(accessKey, cachePolicy.taskDetails))
                ? (task.access ?? cached?.access)
                : (
                    await serverCache.fetch(
                      accessKey,
                      () => taskService.getTask(task.id, workspaceId),
                      { staleTime: cachePolicy.taskDetails },
                    )
                  ).access;
            if (!access || !context.active || accessPrefetchContext.current !== context) return;
            setTaskAccessById((current) => ({ ...current, [task.id]: access }));
            traceTaskAccess(task.id, 'access', 'confirmed');
          } catch (error) {
            const transient = isTransientTaskAccessError(error);
            traceTaskAccess(
              task.id,
              'access',
              transient && attempt < 2 ? 'retrying' : 'failed',
              error,
            );
            if (transient && attempt < 2) {
              setTimeout(
                () => {
                  if (context.active) {
                    context.requested.delete(requestKey);
                    scheduleAccess(task, attempt + 1);
                  }
                },
                500 * 2 ** attempt,
              );
            } else {
              context.requested.delete(requestKey);
              context.cooldownUntil.set(
                requestKey,
                Date.now() + (error instanceof ApiError && error.status === 403 ? 30_000 : 5_000),
              );
            }
          }
        },
      });
    };
    const scheduleWatchers = (task: TaskListItem, attempt = 0) => {
      const requestKey = `watchers:${task.id}`;
      const cooldown = context.cooldownUntil.get(requestKey) ?? 0;
      if (cooldown > Date.now()) return;
      if (cooldown) context.cooldownUntil.delete(requestKey);
      if (!context.active || context.requested.has(requestKey)) return;
      context.requested.add(requestKey);
      const watcherKey = cacheKeys.watchers(userId, workspaceId, task.id);
      const cached = serverCache.get<TaskPerson[]>(watcherKey);
      context.queue.enqueue({
        key: requestKey,
        priority: priorityFor(task.id),
        run: async () => {
          try {
            const watchers =
              cached && serverCache.isFresh(watcherKey, cachePolicy.watchers)
                ? cached
                : await serverCache.fetch(
                    watcherKey,
                    () => taskService.getWatchers(task.id, workspaceId),
                    { staleTime: cachePolicy.watchers },
                  );
            applyWatcherState(task.id, watchers);
            traceTaskAccess(task.id, 'watchers', 'confirmed');
          } catch (error) {
            traceTaskAccess(
              task.id,
              'watchers',
              isTransientTaskAccessError(error) && attempt < 2 ? 'retrying' : 'failed',
              error,
            );
            if (isTransientTaskAccessError(error) && attempt < 2) {
              setTimeout(
                () => {
                  if (context.active) {
                    context.requested.delete(requestKey);
                    scheduleWatchers(task, attempt + 1);
                  }
                },
                500 * 2 ** attempt,
              );
            } else {
              context.requested.delete(requestKey);
              context.cooldownUntil.set(requestKey, Date.now() + 5_000);
            }
          }
        },
      });
    };
    for (const task of visibleTasks) {
      if (!task.access) scheduleAccess(task);
      scheduleWatchers(task);
    }
    return undefined;
  }, [currentPage?.tasks, listKey, userId, visibleTaskIds, workspaceId]);

  useEffect(
    () => () => {
      if (accessPrefetchContext.current) accessPrefetchContext.current.active = false;
    },
    [listKey, userId, workspaceId],
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
      const requestNextPage = () =>
        taskService.listTasks(
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
      const nextPageKey = tasksCacheKey ? `${tasksCacheKey}:page:${currentPage.page + 1}` : null;
      const next = nextPageKey
        ? await serverCache.fetch(nextPageKey, requestNextPage, { staleTime: cachePolicy.taskList })
        : await requestNextPage();
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
      if (tasksCacheKey) {
        serverCache.update<ScopedTaskPage>(tasksCacheKey, (previous) => ({
          ...previous,
          ...next,
          tasks: [...previous.tasks, ...next.tasks],
          workspaceId,
          key: listKey,
        }));
      }
    } catch (requestError) {
      if (!controller.signal.aborted) setError(requestErrorMessage(requestError));
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  };

  const refreshWatchState = (taskId: string) => {
    if (!workspaceId || !userId) return;
    const cached = serverCache.get<TaskPerson[]>(cacheKeys.watchers(userId, workspaceId, taskId));
    if (!cached) return;
    const watching = cached.some((watcher) => watcher.id === userId);
    setWatchStateByTask((current) => ({ ...current, [taskId]: watching }));
    setWatchingTaskIds((current) => {
      const next = new Set(current);
      if (watching) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };

  const updateWatcherCache = (taskId: string, wasWatching: boolean) => {
    if (!userId || !workspaceId || !user) return;
    const key = cacheKeys.watchers(userId, workspaceId, taskId);
    const cached = serverCache.get<TaskPerson[]>(key);
    if (!cached) return;
    serverCache.set(
      key,
      wasWatching
        ? cached.filter((watcher) => watcher.id !== userId)
        : [
            ...cached,
            {
              id: userId,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              profilePictureUrl: user.profilePictureUrl,
            },
          ],
    );
  };

  const closeOpenSwipeable = () => {
    openSwipeable.current?.methods.close();
    openSwipeable.current = null;
    setOpenTaskId(null);
  };

  const handleSwipeOpen = (taskId: string, methods: SwipeableMethods) => {
    if (openSwipeable.current?.taskId !== taskId) openSwipeable.current?.methods.close();
    openSwipeable.current = { taskId, methods };
    setOpenTaskId(taskId);
    refreshWatchState(taskId);
  };

  const handleSwipeClose = (taskId: string) => {
    if (openSwipeable.current?.taskId === taskId) openSwipeable.current = null;
    setOpenTaskId((current) => (current === taskId ? null : current));
  };

  const onViewableItemsChanged = useMemo(
    () =>
      ({ viewableItems }: { viewableItems: { item?: TaskListItem }[] }) => {
        setVisibleTaskIds(
          viewableItems.map((token) => token.item?.id).filter((id): id is string => Boolean(id)),
        );
      },
    [],
  );
  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 20 }), []);

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
    <AppScreen padding="md">
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
                    onPress={() => {
                      closeOpenSwipeable();
                      setRelation(view.value);
                    }}
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
                  onChangeText={(value) => {
                    closeOpenSwipeable();
                    setQuery(value);
                  }}
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
                    onPress={() => {
                      closeOpenSwipeable();
                      setQuery('');
                    }}
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
              onRefresh={() => {
                closeOpenSwipeable();
                setRetry((value) => value + 1);
              }}
              refreshing={loading && Boolean(currentPage)}
              tintColor={colors.primaryAction}
            />
          }
          onScrollBeginDrag={closeOpenSwipeable}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) => (
            <TaskCard
              task={
                item.access || !taskAccessById[item.id]
                  ? item
                  : { ...item, access: taskAccessById[item.id] }
              }
              watching={watchingTaskIds.has(item.id)}
              watchKnown={
                watchStateByTask[item.id] !== undefined && watchStateByTask[item.id] !== null
              }
              watchLoading={watchLoadingId === item.id}
              onClose={handleSwipeClose}
              onOpen={handleSwipeOpen}
              onActions={(selected) => {
                closeOpenSwipeable();
                setOpenTaskId(selected.id);
                setActionTask(selected);
                refreshWatchState(selected.id);
              }}
              onWatch={(selected) => {
                if (!workspaceId) return;
                setWatchLoadingId(selected.id);
                const isWatching = watchingTaskIds.has(selected.id);
                void (async () => {
                  try {
                    if (isWatching) await taskService.unwatchTask(selected.id, workspaceId);
                    else await taskService.watchTask(selected.id, workspaceId);
                    updateWatcherCache(selected.id, isWatching);
                    setWatchingTaskIds((current) => {
                      const next = new Set(current);
                      if (isWatching) next.delete(selected.id);
                      else next.add(selected.id);
                      return next;
                    });
                    setWatchStateByTask((current) => ({
                      ...current,
                      [selected.id]: !isWatching,
                    }));
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
                  watchStateByTask[actionTask.id] == null
                    ? 'Watch state unavailable'
                    : watchingTaskIds.has(actionTask.id)
                      ? 'Unwatch task'
                      : 'Watch task'
                }
                disabled={
                  watchLoadingId === actionTask.id || watchStateByTask[actionTask.id] == null
                }
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
                    updateWatcherCache(actionTask.id, isWatching);
                    setWatchStateByTask((current) => ({
                      ...current,
                      [actionTask.id]: !isWatching,
                    }));
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
                    if (tasksCacheKey) {
                      serverCache.update<ScopedTaskPage>(tasksCacheKey, (previous) => ({
                        ...previous,
                        tasks: previous.tasks.map((task) =>
                          task.id === updated.id ? { ...task, ...updated } : task,
                        ),
                      }));
                    }
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
                setOpenTaskId(null);
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
