import { router, useFocusEffect } from 'expo-router';
import { CalendarDays, ChevronRight, ListTodo } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { AppButton, AppCard, AppScreen, AppText, InlineError, LoadingState } from '../../components/ui';
import { getDueDateLabel } from '../home/dashboard-utils';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskListItem,
  type TaskPage,
  type TaskPriority,
  type TaskRelation,
  type TaskStatus,
  taskService,
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

function personLabel(person: TaskListItem['assignee']): string | null {
  if (!person) return null;
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || null;
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
        minHeight: themeTokens.touchTarget.minimum,
        justifyContent: 'center',
        borderRadius: themeTokens.radius.pill,
        paddingHorizontal: themeTokens.spacing.md,
        backgroundColor: selected ? colors.primarySurface : colors.surface,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <AppText tone={selected ? 'link' : 'secondary'} variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

function TaskCard({ task }: { task: TaskListItem }) {
  const { colors } = useAppTheme();
  const assigneeNames = task.assignees?.length
    ? task.assignees.map(personLabel).filter(Boolean).join(', ')
    : personLabel(task.assignee);
  const dueLabel = getDueDateLabel(task.deadline);
  const related = [task.project?.name, task.team?.name, assigneeNames].filter(Boolean).join(' · ');

  return (
    <AppCard
      accessibilityLabel={`Open task ${task.title}`}
      onPress={() => router.push(`/tasks/${encodeURIComponent(task.id)}`)}
      padding="sm"
      style={{ gap: themeTokens.spacing.xs }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
        <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
          <AppText numberOfLines={2} variant="label">
            {task.title}
          </AppText>
          <AppText numberOfLines={1} tone="secondary" variant="caption">
            {labelFor(task.status)} · {labelFor(task.priority)}
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
      {related ? (
        <AppText numberOfLines={1} tone="subtle" variant="caption">
          {related}
        </AppText>
      ) : null}
    </AppCard>
  );
}

export function TasksScreen() {
  const { activeWorkspace, permissions, status, workspacePermissionStatus, logout } = useAuth();
  const { colors } = useAppTheme();
  const [relation, setRelation] = useState<TaskRelation>('assigned');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('');
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
    relation,
    statusFilter,
    priorityFilter,
    debouncedQuery,
  ].join('|');
  const currentPage = pageData?.workspaceId === workspaceId && pageData.key === listKey
    ? pageData
    : null;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim().slice(0, 100)), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (relation === 'all' && !canViewAllTasks) setRelation('assigned');
  }, [canViewAllTasks, relation]);

  useFocusEffect(
    useCallback(() => {
      if (!isReady || !workspaceId) return undefined;
      if (relation === 'all' && !canViewAllTasks) return undefined;

      const controller = new AbortController();
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
            relation,
            page: 1,
            query: debouncedQuery,
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(priorityFilter ? { priority: priorityFilter } : {}),
            canViewAllTasks,
          },
          controller.signal,
        )
        .then((response) => {
          if (controller.signal.aborted) return;
          setPageData({ ...response, workspaceId, key: listKey });
        })
        .catch(async (requestError: unknown) => {
          if (controller.signal.aborted) return;
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
          if (!controller.signal.aborted) setLoading(false);
        });

      return () => {
        controller.abort();
        moreRequest.current?.abort();
      };
    }, [
      canViewAllTasks,
      debouncedQuery,
      isReady,
      listKey,
      logout,
      priorityFilter,
      relation,
      statusFilter,
      workspaceId,
      retry,
    ]),
  );

  const loadMore = async () => {
    if (!currentPage || loadingMore || currentPage.tasks.length >= currentPage.total || !workspaceId)
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
          relation,
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

  return (
    <AppScreen padding="md">
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          gap: themeTokens.spacing.md,
          paddingBottom: themeTokens.spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[colors.primaryAction]}
            onRefresh={() => setRetry((value) => value + 1)}
            refreshing={loading && Boolean(currentPage)}
            tintColor={colors.primaryAction}
          />
        }
        testID="tasks-scroll-view"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
          <ListTodo color={colors.primaryAction} size={24} />
          <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
            Tasks
          </AppText>
          {canCreateTasks && (
            <AppButton
              accessibilityLabel="Create task"
              onPress={() => router.push('/task-create')}
              style={{ minWidth: 104 }}
              variant="primary"
            >
              Create
            </AppButton>
          )}
        </View>

        <View
          accessibilityRole="tablist"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.xs }}
        >
          {views.map((view) => (
            <FilterChip
              key={view.value}
              label={view.label}
              onPress={() => setRelation(view.value)}
              selected={relation === view.value}
            />
          ))}
        </View>

        <View
          style={{
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: themeTokens.radius.md,
            paddingLeft: themeTokens.spacing.sm,
            backgroundColor: colors.surface,
          }}
        >
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
              minHeight: 50,
              color: colors.text,
              paddingHorizontal: themeTokens.spacing.sm,
              fontSize: 16,
            }}
            testID="task-search-input"
            value={query}
          />
        </View>

        <View style={{ gap: themeTokens.spacing.xs }}>
          <AppText variant="label">Status</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.xs }}>
            <FilterChip
              label="Any status"
              onPress={() => setStatusFilter('')}
              selected={!statusFilter}
            />
            {TASK_STATUSES.map((value) => (
              <FilterChip
                key={value}
                label={labelFor(value)}
                onPress={() => setStatusFilter(value)}
                selected={statusFilter === value}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: themeTokens.spacing.xs }}>
          <AppText variant="label">Priority</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.xs }}>
            <FilterChip
              label="Any priority"
              onPress={() => setPriorityFilter('')}
              selected={!priorityFilter}
            />
            {TASK_PRIORITIES.map((value) => (
              <FilterChip
                key={value}
                label={labelFor(value)}
                onPress={() => setPriorityFilter(value)}
                selected={priorityFilter === value}
              />
            ))}
          </View>
        </View>

        <View
          accessibilityLabel="Due date filtering is unavailable from the task service"
          accessibilityRole="text"
          style={{
            minHeight: themeTokens.touchTarget.minimum,
            flexDirection: 'row',
            alignItems: 'center',
            gap: themeTokens.spacing.xs,
            paddingHorizontal: themeTokens.spacing.sm,
            borderRadius: themeTokens.radius.sm,
            backgroundColor: colors.surfaceSubtle,
          }}
        >
          <CalendarDays color={colors.textMuted} size={18} />
          <AppText tone="secondary" variant="caption">
            Due-date filtering is not available in the current task API.
          </AppText>
        </View>

        {error && (
          <InlineError
            message={error}
            onRetry={() => setRetry((value) => value + 1)}
            retryLabel="Retry loading tasks"
          />
        )}

        {loading && !currentPage ? <LoadingState label="Loading tasks" /> : null}
        {currentPage?.tasks.map((task) => <TaskCard key={task.id} task={task} />)}

        {!loading && !error && currentPage && currentPage.tasks.length === 0 && (
          <View style={{ alignItems: 'center', gap: themeTokens.spacing.sm, paddingVertical: 24 }}>
            <AppText variant="heading">No tasks found</AppText>
            <AppText style={{ textAlign: 'center' }} tone="secondary">
              {query || statusFilter || priorityFilter
                ? 'Try changing your search or filters.'
                : relation === 'assigned'
                  ? 'Tasks assigned to you will appear here.'
                  : relation === 'created'
                    ? 'Tasks you create will appear here.'
                    : 'There are no tasks in this workspace.'}
            </AppText>
          </View>
        )}

        {currentPage && currentPage.tasks.length > 0 && currentPage.tasks.length < currentPage.total && (
          <AppButton
            accessibilityLabel="Load more tasks"
            loading={loadingMore}
            onPress={() => void loadMore()}
            variant="outline"
          >
            Load more
          </AppButton>
        )}

        {currentPage && currentPage.tasks.length > 0 && (
          <AppText accessibilityLiveRegion="polite" style={{ textAlign: 'center' }} tone="subtle" variant="caption">
            Showing {currentPage.tasks.length} of {currentPage.total} tasks
          </AppText>
        )}
      </ScrollView>
    </AppScreen>
  );
}
