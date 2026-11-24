import { router, useFocusEffect } from 'expo-router';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { canCreateProjects, isMyProject } from './permissions';
import {
  PROJECT_STATUSES,
  type ProjectRecord,
  projectService,
  type ProjectStatus,
} from './service';

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

interface LoadedProjects {
  workspaceId: string;
  search: string;
  projects: ProjectRecord[];
}

function dateLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function requestErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError)
    return 'You appear to be offline. Reconnect and try loading projects again.';
  if (error instanceof ApiTimeoutError) return 'Loading projects took too long. Please try again.';
  if (error instanceof ApiError && error.status === 403)
    return 'You do not have permission to view projects in this workspace.';
  if (error instanceof ApiError && error.status === 423)
    return 'This workspace is temporarily suspended.';
  return 'Projects could not be loaded. Please try again.';
}

function ProjectCard({ project }: { project: ProjectRecord }) {
  const { colors } = useAppTheme();
  const dueDate = dateLabel(project.dueDate ?? project.endDate);
  const teamName = project.team?.name;
  return (
    <AppCard
      accessibilityLabel={`Open project ${project.name}`}
      onPress={() => router.push(`/projects/${encodeURIComponent(project.id)}`)}
      padding="sm"
      style={{ gap: themeTokens.spacing.xxs, borderWidth: 0 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
        <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
          <AppText numberOfLines={2} variant="label">
            {project.name}
          </AppText>
          <AppText numberOfLines={1} tone="secondary" variant="caption">
            {PROJECT_STATUS_LABELS[project.status]}
            {teamName ? ` · ${teamName}` : ''}
          </AppText>
        </View>
        <ChevronRight color={colors.textMuted} size={18} />
      </View>
      {project.description ? (
        <AppText numberOfLines={2} tone="secondary" variant="caption">
          {project.description}
        </AppText>
      ) : null}
      {dueDate ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.xxs }}>
          <CalendarDays color={colors.textMuted} size={14} />
          <AppText tone="secondary" variant="caption">
            Due {dueDate}
          </AppText>
        </View>
      ) : null}
    </AppCard>
  );
}

export function ProjectListScreen() {
  const { activeWorkspace, permissions, status, workspacePermissionStatus, user, logout } =
    useAuth();
  const { colors } = useAppTheme();
  const workspaceId = activeWorkspace?.companyId ?? null;
  const isReady =
    status === 'authenticated' &&
    workspacePermissionStatus === 'ready' &&
    Boolean(activeWorkspace && workspaceId);
  const canViewAllProjects =
    permissions?.permissions.view_all_projects === true &&
    ['owner', 'admin', 'manager', 'member'].includes(permissions.role);
  const [loaded, setLoaded] = useState<LoadedProjects | null>(null);
  const [error, setError] = useState<{ workspaceId: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('active');
  const [selectedScope, setSelectedScope] = useState<'all' | 'mine'>('all');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [governance, setGovernance] = useState<{
    workspaceId: string;
    retry: number;
    projectCreationRestricted: boolean;
  } | null>(null);
  const [governanceError, setGovernanceError] = useState<{
    workspaceId: string;
    retry: number;
    message: string;
  } | null>(null);
  const [governanceRetry, setGovernanceRetry] = useState(0);
  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);
  const scope = canViewAllProjects ? selectedScope : 'all';
  const userId = user?.id;

  const currentProjects =
    loaded?.workspaceId === workspaceId && loaded.search === debouncedQuery
      ? loaded.projects
      : null;
  const currentError = error?.workspaceId === workspaceId ? error.message : null;
  const currentGovernance =
    ['owner', 'admin', 'manager', 'member'].includes(permissions?.role ?? '') &&
    governance?.workspaceId === workspaceId &&
    governance.retry === governanceRetry
      ? governance
      : null;
  const currentGovernanceError =
    governanceError?.workspaceId === workspaceId && governanceError.retry === governanceRetry
      ? governanceError.message
      : null;
  const showCreate = canCreateProjects(
    permissions,
    currentGovernance
      ? { projectCreationRestricted: currentGovernance.projectCreationRestricted }
      : null,
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (
      !isReady ||
      !workspaceId ||
      !permissions ||
      permissions.permissions.create_projects !== true
    ) {
      return;
    }
    const controller = new AbortController();
    if (!['owner', 'admin', 'manager', 'member'].includes(permissions.role)) {
      return () => controller.abort();
    }
    void projectService
      .getGovernanceCapabilities(workspaceId, controller.signal)
      .then((capabilities) => {
        if (!controller.signal.aborted) {
          setGovernance({ workspaceId, retry: governanceRetry, ...capabilities });
        }
      })
      .catch(async (requestError: unknown) => {
        if (controller.signal.aborted) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          try {
            await logoutRef.current();
            router.replace('/sign-in');
          } catch {
            setGovernanceError({
              workspaceId,
              retry: governanceRetry,
              message: 'Your session could not be cleared safely. Please try again.',
            });
          }
        } else if (requestError instanceof ApiError && requestError.status === 423) {
          router.replace('/workspace-suspended');
        } else {
          setGovernanceError({
            workspaceId,
            retry: governanceRetry,
            message: requestErrorMessage(requestError),
          });
        }
      });
    return () => controller.abort();
  }, [governanceRetry, isReady, permissions, workspaceId]);

  useFocusEffect(
    useCallback(() => {
      if (!isReady || !workspaceId) return undefined;
      const controller = new AbortController();
      const requestRetry = retry;
      setLoading(true);
      setError(null);
      void projectService
        .listProjects(workspaceId, { search: debouncedQuery, signal: controller.signal })
        .then((projects) => {
          if (!controller.signal.aborted && requestRetry === retry) {
            setLoaded({ workspaceId, search: debouncedQuery, projects });
          }
        })
        .catch(async (requestError: unknown) => {
          if (controller.signal.aborted || requestRetry !== retry) return;
          if (requestError instanceof ApiError && requestError.status === 401) {
            try {
              await logoutRef.current();
              router.replace('/sign-in');
            } catch {
              setError({
                workspaceId,
                message: 'Your session could not be cleared safely. Please try again.',
              });
            }
          } else if (requestError instanceof ApiError && requestError.status === 423) {
            router.replace('/workspace-suspended');
          } else {
            setError({ workspaceId, message: requestErrorMessage(requestError) });
          }
        })
        .finally(() => {
          if (!controller.signal.aborted && requestRetry === retry) setLoading(false);
        });
      return () => controller.abort();
    }, [debouncedQuery, isReady, retry, workspaceId]),
  );

  const filteredProjects = useMemo(() => {
    if (!currentProjects) return [];
    return currentProjects.filter((project) => {
      const matchesStatus = !statusFilter || project.status === statusFilter;
      const matchesScope =
        !canViewAllProjects || scope === 'all' || (userId ? isMyProject(project, userId) : false);
      return matchesStatus && matchesScope;
    });
  }, [canViewAllProjects, currentProjects, scope, statusFilter, userId]);

  if (!isReady) {
    return (
      <AppScreen>
        <LoadingState label="Verifying workspace access" variant="fullScreen" />
      </AppScreen>
    );
  }

  const statusFilterLabel = statusFilter ? PROJECT_STATUS_LABELS[statusFilter] : 'All statuses';
  const hasFilters = Boolean(
    debouncedQuery || (statusFilter && statusFilter !== 'active') || scope === 'mine',
  );
  const emptyTitle = currentError
    ? 'Projects are unavailable'
    : debouncedQuery || scope === 'mine'
      ? 'No matching projects'
      : statusFilter
        ? `No ${PROJECT_STATUS_LABELS[statusFilter].toLowerCase()} projects`
        : 'No projects yet';

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
        data={filteredProjects}
        keyExtractor={(project) => project.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: themeTokens.spacing.sm, marginBottom: themeTokens.spacing.xs }}>
            <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center' }}>
              <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
                Projects
              </AppText>
              {showCreate && (
                <AppButton
                  accessibilityLabel="Create project"
                  icon={<FolderKanban color={colors.onPrimary} size={16} />}
                  onPress={() => router.push('/project-create')}
                  style={{ minHeight: 40, minWidth: 112 }}
                >
                  + Create
                </AppButton>
              )}
            </View>
            {canViewAllProjects && (
              <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4 }}>
                {[
                  { value: 'all' as const, label: 'All projects' },
                  { value: 'mine' as const, label: 'My projects' },
                ].map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: scope === item.value }}
                    key={item.value}
                    onPress={() => setSelectedScope(item.value)}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottomWidth: scope === item.value ? 2 : 1,
                      borderBottomColor:
                        scope === item.value ? colors.primaryAction : colors.border,
                    }}
                  >
                    <AppText tone={scope === item.value ? 'link' : 'secondary'} variant="caption">
                      {item.label}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            )}
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
                accessibilityLabel="Search projects"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={100}
                onChangeText={setQuery}
                placeholder="Search projects"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                style={{
                  flex: 1,
                  minHeight: 42,
                  color: colors.text,
                  paddingHorizontal: themeTokens.spacing.sm,
                  fontSize: 16,
                }}
                value={query}
              />
              {query.length > 0 && (
                <Pressable
                  accessibilityLabel="Clear project search"
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
            <Pressable
              accessibilityLabel={`Filter projects, ${statusFilterLabel}`}
              accessibilityRole="button"
              onPress={() => setFiltersVisible(true)}
              style={{
                alignSelf: 'flex-start',
                minHeight: 38,
                flexDirection: 'row',
                alignItems: 'center',
                gap: themeTokens.spacing.xs,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: themeTokens.radius.pill,
                paddingHorizontal: themeTokens.spacing.sm,
                backgroundColor: colors.surface,
              }}
            >
              <SlidersHorizontal color={colors.primaryAction} size={16} />
              <AppText variant="caption">{statusFilterLabel}</AppText>
              <ChevronDown color={colors.textMuted} size={15} />
            </Pressable>
            {debouncedQuery.length > 0 && (currentProjects?.length ?? 0) >= 50 && (
              <AppText tone="secondary" variant="caption">
                Search results are limited to the first 50 projects.
              </AppText>
            )}
            {currentError && (
              <InlineError
                message={currentError}
                onRetry={() => setRetry((value) => value + 1)}
                retryLabel="Retry loading projects"
              />
            )}
            {currentGovernanceError && (
              <InlineError
                message={currentGovernanceError}
                onRetry={() => setGovernanceRetry((value) => value + 1)}
                retryLabel="Retry checking project permissions"
              />
            )}
            {loading && !currentProjects && !currentError && (
              <LoadingState label="Loading projects" />
            )}
          </View>
        }
        ListEmptyComponent={
          (loading && !currentProjects) || currentError ? undefined : (
            <View style={{ alignItems: 'center', gap: themeTokens.spacing.sm, padding: 24 }}>
              <AppText accessibilityRole="header" variant="label">
                {emptyTitle}
              </AppText>
              <AppText style={{ textAlign: 'center' }} tone="secondary">
                {hasFilters
                  ? 'Try another search or filter.'
                  : 'Projects you can access in this workspace will appear here.'}
              </AppText>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            colors={[colors.primaryAction]}
            onRefresh={() => setRetry((value) => value + 1)}
            refreshing={loading && Boolean(currentProjects)}
            tintColor={colors.primaryAction}
          />
        }
        renderItem={({ item }) => <ProjectCard project={item} />}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        testID="projects-list"
      />
      <BottomSheet
        footer={
          <AppButton
            accessibilityLabel="Close project filters"
            onPress={() => setFiltersVisible(false)}
            style={{ marginTop: themeTokens.spacing.md }}
            variant="outline"
          >
            Done
          </AppButton>
        }
        onClose={() => setFiltersVisible(false)}
        title="Filter projects"
        visible={filtersVisible}
      >
        <View style={{ gap: themeTokens.spacing.xs }}>
          <AppText variant="label">Status</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.xs }}>
            {(['', ...PROJECT_STATUSES] as (ProjectStatus | '')[]).map((value) => {
              const label = value ? PROJECT_STATUS_LABELS[value] : 'All statuses';
              const selected = statusFilter === value;
              return (
                <Pressable
                  accessibilityLabel={`Filter status: ${label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={value || 'all'}
                  onPress={() => setStatusFilter(value)}
                  style={{
                    minHeight: themeTokens.touchTarget.minimum,
                    justifyContent: 'center',
                    borderRadius: themeTokens.radius.pill,
                    paddingHorizontal: themeTokens.spacing.md,
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
            })}
          </View>
        </View>
      </BottomSheet>
    </AppScreen>
  );
}
