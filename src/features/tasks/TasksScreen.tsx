import { router, useFocusEffect } from 'expo-router';
import {
  ChevronDown,
  ChevronRight,
  ListTodo,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput, View } from 'react-native';

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

function TaskCard({ task }: { task: TaskListItem }) {
  const { colors } = useAppTheme();
  const dueLabel = getDueDateLabel(task.deadline);
  const related = task.project?.name ?? task.team?.name ?? null;

  return (
    <AppCard
      accessibilityLabel={`Open task ${task.title}`}
      onPress={() => router.push(`/tasks/${encodeURIComponent(task.id)}`)}
      padding="sm"
      style={{ gap: themeTokens.spacing.xxs, borderWidth: 0 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
        <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
          <AppText numberOfLines={2} variant="label">
            {task.title}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.xs }}>
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
  const { activeWorkspace } = useAuth();
  return <TasksScreenContent key={activeWorkspace?.companyId ?? 'no-workspace'} />;
}

function TasksScreenContent() {
  const { activeWorkspace, permissions, status, workspacePermissionStatus, logout } = useAuth();
  const { colors } = useAppTheme();
  const [relation, setRelation] = useState<TaskRelation>('assigned');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('');
  const [draftStatus, setDraftStatus] = useState<StatusFilter>('');
  const [draftPriority, setDraftPriority] = useState<PriorityFilter>('');
  const [filtersVisible, setFiltersVisible] = useState(false);
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
    <AppScreen padding="md">
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
        renderItem={({ item }) => <TaskCard task={item} />}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        testID="tasks-list"
      />
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
