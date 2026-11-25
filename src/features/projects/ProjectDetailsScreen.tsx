import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Folder,
  FolderKanban,
  Plus,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';

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
import { cacheKeys } from '../../data/cacheKeys';
import { cachePolicy, serverCache } from '../../data/serverCache';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { SecureImagePreview } from '../files/SecureImagePreview';
import { canCreateProjectTasks, canEditProject } from './permissions';
import {
  type ProjectFileListing,
  type ProjectMember,
  type ProjectRecord,
  projectService,
  type ProjectStatus,
  type ProjectTask,
} from './service';

type ProjectSection = 'overview' | 'tasks' | 'members' | 'files';

interface LoadedProject {
  workspaceId: string;
  projectId: string;
  project: ProjectRecord;
  tasks: ProjectTask[] | null;
  members: ProjectMember[] | null;
  taskError: string | null;
  memberError: string | null;
}

interface LoadedFiles {
  workspaceId: string;
  projectId: string;
  folderId: string | undefined;
  retry: number;
  listing: ProjectFileListing;
}

const SECTION_LABELS: Record<ProjectSection, string> = {
  overview: 'Overview',
  tasks: 'Tasks',
  members: 'Members',
  files: 'Files',
};

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

function labelFor(value: string | null | undefined): string {
  return value
    ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Not set';
}

function dateLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const datePart = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const date = datePart ? new Date(`${datePart}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function projectErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError)
    return 'You appear to be offline. Reconnect and try loading this project again.';
  if (error instanceof ApiTimeoutError)
    return 'Loading this project took too long. Please try again.';
  if (error instanceof ApiError && error.status === 403)
    return 'You do not have access to this project.';
  if (error instanceof ApiError && error.status === 404)
    return 'This project is unavailable in the active workspace.';
  return 'Project details could not be loaded. Please try again.';
}

function projectMemberErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403)
    return 'You do not have permission to view members for this project.';
  if (error instanceof ApiError && error.status === 404)
    return 'This project is unavailable in the active workspace.';
  if (error instanceof ApiNetworkError)
    return 'You appear to be offline. Reconnect and try loading project members again.';
  return 'Project members could not be loaded. Please try again.';
}

function initialsFor(member: ProjectMember): string {
  return [member.firstName, member.lastName]
    .filter(Boolean)
    .map((name) => name?.trim().charAt(0) ?? '')
    .join('')
    .toUpperCase();
}

function memberName(member: ProjectMember): string {
  return [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || 'Workspace member';
}

function taskAssignee(task: ProjectTask): string | null {
  const assignee = task.assignee;
  return assignee
    ? [assignee.firstName, assignee.lastName].filter(Boolean).join(' ').trim() || 'Assigned'
    : null;
}

function ProjectFileCard({
  file,
  workspaceId,
  projectId,
  collection,
}: {
  file: ProjectFileListing['files'][number];
  workspaceId: string;
  projectId: string;
  collection: string;
}) {
  const download = useCallback(
    () => projectService.downloadProjectFile(file.id, workspaceId),
    [file.id, workspaceId],
  );
  return (
    <AppCard
      accessibilityLabel={`Open project file ${file.fileName}`}
      onPress={() =>
        router.push({
          pathname: '/file-viewer',
          params: {
            taskId: '',
            attachmentId: file.id,
            projectFileId: file.id,
            projectId,
            fileName: file.fileName,
            fileType: file.fileType,
            collection,
          },
        })
      }
      padding="sm"
      style={{ width: '48%', minHeight: 150, gap: themeTokens.spacing.sm, borderWidth: 0 }}
    >
      <SecureImagePreview
        download={download}
        fileName={file.fileName}
        mimeType={file.fileType}
        size={file.fileSize}
      />
    </AppCard>
  );
}

export function ProjectDetailsScreen({
  projectId,
  initialSection,
  returnToInbox = false,
}: {
  projectId: string;
  initialSection?: string;
  returnToInbox?: boolean;
}) {
  const { activeWorkspace, permissions, status, user, workspacePermissionStatus, logout } =
    useAuth();
  const { colors } = useAppTheme();
  const returnToProjectList = () => router.replace(returnToInbox ? '/inbox' : '/(tabs)/projects');
  const workspaceId = activeWorkspace?.companyId ?? null;
  const isReady =
    status === 'authenticated' &&
    workspacePermissionStatus === 'ready' &&
    Boolean(activeWorkspace && workspaceId);
  const [loaded, setLoaded] = useState<LoadedProject | null>(null);
  const [loadError, setLoadError] = useState<{
    workspaceId: string;
    projectId: string;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const sectionKey = `${projectId}|${initialSection ?? ''}`;
  const initialSectionValue = initialSection === 'tasks' ? 'tasks' : 'overview';
  const [selectedSection, setSelectedSection] = useState<{
    key: string;
    section: ProjectSection;
  }>({ key: sectionKey, section: initialSectionValue });
  const section =
    selectedSection.key === sectionKey ? selectedSection.section : initialSectionValue;
  const setSection = (nextSection: ProjectSection) =>
    setSelectedSection({ key: sectionKey, section: nextSection });
  const [fileRetry, setFileRetry] = useState(0);
  const [folderSelection, setFolderSelection] = useState<{
    workspaceId: string | null;
    projectId: string;
    folderId?: string;
  }>({ workspaceId, projectId });
  const folderId =
    folderSelection.workspaceId === workspaceId && folderSelection.projectId === projectId
      ? folderSelection.folderId
      : undefined;
  const [loadedFiles, setLoadedFiles] = useState<LoadedFiles | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const current =
    loaded?.workspaceId === workspaceId && loaded.projectId === projectId ? loaded : null;
  const currentFiles =
    loadedFiles?.workspaceId === workspaceId &&
    loadedFiles.projectId === projectId &&
    loadedFiles.folderId === folderId &&
    loadedFiles.retry === fileRetry
      ? loadedFiles.listing
      : null;
  const currentLoadError =
    loadError?.workspaceId === workspaceId && loadError.projectId === projectId
      ? loadError.message
      : null;
  const project = current?.project ?? null;
  const members = current?.members ?? [];
  const canEdit = project ? canEditProject(permissions, members) : false;
  const canAddTask = canCreateProjectTasks(permissions);

  useFocusEffect(
    useCallback(() => {
      if (!isReady || !workspaceId || !projectId) return undefined;
      const controller = new AbortController();
      const requestRetry = retry;
      const key = user?.id ? cacheKeys.project(user.id, workspaceId, projectId) : null;
      const cached = key ? serverCache.get<LoadedProject>(key) : undefined;
      if (cached) {
        setLoaded(cached);
        setLoading(false);
      } else setLoading(true);
      setLoadError(null);
      void (
        key
          ? serverCache.fetch(
              `${key}:record`,
              () => projectService.getProject(projectId, workspaceId, controller.signal),
              { staleTime: cachePolicy.projects, force: retry > 0 },
            )
          : projectService.getProject(projectId, workspaceId, controller.signal)
      )
        .then(async (result) => {
          if (controller.signal.aborted) return;
          const [tasksResult, membersResult] = await Promise.allSettled([
            projectService.listProjectTasks(projectId, workspaceId, controller.signal),
            projectService.getProjectMembers(projectId, workspaceId, controller.signal),
          ]);
          if (controller.signal.aborted || requestRetry !== retry) return;
          for (const result of [tasksResult, membersResult]) {
            if (
              result.status === 'rejected' &&
              result.reason instanceof ApiError &&
              [401, 423].includes(result.reason.status)
            ) {
              throw result.reason;
            }
          }
          const next = {
            workspaceId,
            projectId,
            project: result,
            tasks: tasksResult.status === 'fulfilled' ? tasksResult.value : null,
            members: membersResult.status === 'fulfilled' ? membersResult.value : null,
            taskError:
              tasksResult.status === 'rejected' ? 'Project tasks could not be loaded.' : null,
            memberError:
              membersResult.status === 'rejected'
                ? projectMemberErrorMessage(membersResult.reason)
                : null,
          };
          if (key) serverCache.set(key, next);
          setLoaded(next);
        })
        .catch(async (requestError: unknown) => {
          if (controller.signal.aborted || requestRetry !== retry) return;
          if (
            cached &&
            !(requestError instanceof ApiError && [401, 423].includes(requestError.status))
          ) {
            return;
          }
          if (!cached) setLoaded(null);
          if (requestError instanceof ApiError && requestError.status === 401) {
            try {
              await logoutRef.current();
              router.replace('/sign-in');
            } catch {
              setLoadError({
                workspaceId,
                projectId,
                message: 'Your session could not be cleared safely. Please try again.',
              });
            }
          } else if (requestError instanceof ApiError && requestError.status === 423) {
            router.replace('/workspace-suspended');
          } else {
            setLoadError({
              workspaceId,
              projectId,
              message: projectErrorMessage(requestError),
            });
          }
        })
        .finally(() => {
          if (!controller.signal.aborted && requestRetry === retry) setLoading(false);
        });
      return () => controller.abort();
    }, [isReady, projectId, retry, user, workspaceId]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!isReady || !workspaceId || !projectId || section !== 'files') return undefined;
      const controller = new AbortController();
      const key = user?.id
        ? cacheKeys.projectFiles(user.id, workspaceId, projectId, folderId)
        : null;
      const cached = key ? serverCache.get<ProjectFileListing>(key) : undefined;
      if (cached) {
        setLoadedFiles({ workspaceId, projectId, folderId, retry: fileRetry, listing: cached });
        setFilesLoading(false);
      } else setFilesLoading(true);
      setFileError(null);
      void (
        key
          ? serverCache.fetch(
              key,
              () =>
                projectService.getProjectFiles(projectId, workspaceId, folderId, controller.signal),
              { staleTime: cachePolicy.projects, force: fileRetry > 0 },
            )
          : projectService.getProjectFiles(projectId, workspaceId, folderId, controller.signal)
      )
        .then((listing) => {
          if (!controller.signal.aborted) {
            setLoadedFiles({ workspaceId, projectId, folderId, retry: fileRetry, listing });
          }
        })
        .catch(async (requestError: unknown) => {
          if (controller.signal.aborted) return;
          if (
            cached &&
            !(requestError instanceof ApiError && [401, 423].includes(requestError.status))
          ) {
            return;
          }
          if (!cached) setLoadedFiles(null);
          if (requestError instanceof ApiError && requestError.status === 401) {
            try {
              await logoutRef.current();
              router.replace('/sign-in');
            } catch {
              setFileError('Your session could not be cleared safely. Please try again.');
            }
          } else if (requestError instanceof ApiError && requestError.status === 423) {
            router.replace('/workspace-suspended');
          } else {
            setFileError(projectErrorMessage(requestError));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setFilesLoading(false);
        });
      return () => controller.abort();
    }, [fileRetry, folderId, isReady, projectId, section, user, workspaceId]),
  );

  if (!isReady) {
    return (
      <AppScreen>
        <LoadingState label="Verifying workspace access" variant="fullScreen" />
      </AppScreen>
    );
  }

  if (loading && !current && !currentLoadError) {
    return (
      <AppScreen>
        <LoadingState label="Loading project details" variant="fullScreen" />
      </AppScreen>
    );
  }

  if (!project) {
    return (
      <AppScreen scrollable>
        <View style={{ gap: themeTokens.spacing.md }}>
          <IconButton
            accessibilityLabel="Back to Projects"
            icon={<ArrowLeft color={colors.text} size={22} />}
            onPress={returnToProjectList}
          />
          {currentLoadError ? (
            <InlineError
              message={currentLoadError}
              onRetry={() => setRetry((value) => value + 1)}
              retryLabel="Retry loading project"
            />
          ) : (
            <AppText tone="secondary">This project is unavailable.</AppText>
          )}
          <AppButton
            accessibilityLabel="Return to Projects"
            onPress={returnToProjectList}
            variant="outline"
          >
            Back to Projects
          </AppButton>
        </View>
      </AppScreen>
    );
  }

  const activeMembers = members.filter((member) => member.status === 'active');
  const tasks = current?.tasks ?? [];
  const completedTasks = tasks.filter((task) => task.status === 'completed').length;
  const completionPercent = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const deadline = project.dueDate ?? project.endDate;
  const owner =
    activeMembers.find((member) => member.id === project.leadId) ??
    activeMembers.find((member) => member.id === project.createdBy);
  const sectionList = (Object.keys(SECTION_LABELS) as ProjectSection[]).map((value) => ({
    value,
    label: SECTION_LABELS[value],
  }));
  const fileListing = currentFiles;
  const selectFolder = (nextFolderId?: string) =>
    setFolderSelection({ workspaceId, projectId, folderId: nextFolderId });

  const openProjectTask = (task: ProjectTask) => {
    router.push(
      `/tasks/${encodeURIComponent(task.id)}?projectId=${encodeURIComponent(project.id)}&fromProject=1`,
    );
  };

  return (
    <AppScreen padding="md">
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
            onRefresh={() => {
              setRetry((value) => value + 1);
              setFileRetry((value) => value + 1);
            }}
            refreshing={loading}
            tintColor={colors.primaryAction}
          />
        }
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconButton
            accessibilityLabel="Back to Projects"
            icon={<ArrowLeft color={colors.text} size={22} />}
            onPress={() => {
              if (returnToInbox) router.replace('/inbox');
              else if (router.canGoBack()) router.back();
              else router.replace('/(tabs)/projects');
            }}
          />
          <AppText
            accessibilityRole="header"
            numberOfLines={1}
            style={{ flex: 1 }}
            variant="heading"
          >
            {project.name}
          </AppText>
          {canEdit && (
            <AppButton
              accessibilityLabel="Edit project"
              onPress={() => router.push(`/projects/${encodeURIComponent(project.id)}/edit`)}
              style={{ minHeight: 40 }}
              variant="outline"
            >
              Edit
            </AppButton>
          )}
        </View>

        {currentLoadError && <InlineError message={currentLoadError} />}

        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          {sectionList.map(({ value, label }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: section === value }}
              key={value}
              onPress={() => setSection(value)}
              style={{
                flex: 1,
                minHeight: 42,
                alignItems: 'center',
                justifyContent: 'center',
                borderBottomWidth: section === value ? 2 : 0,
                borderBottomColor: colors.primaryAction,
              }}
            >
              <AppText tone={section === value ? 'link' : 'secondary'} variant="caption">
                {label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {section === 'overview' && (
          <View style={{ gap: themeTokens.spacing.md }}>
            <AppCard padding="md" style={{ gap: themeTokens.spacing.sm, borderWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  accessibilityLabel={`Project icon for ${project.name}`}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: themeTokens.radius.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      project.color && /^#[0-9a-f]{6}$/i.test(project.color)
                        ? project.color
                        : colors.primaryAction,
                  }}
                >
                  {project.logoUrl?.startsWith('https://') ? (
                    <Image
                      accessibilityLabel={`${project.name} logo`}
                      resizeMode="cover"
                      source={{ uri: project.logoUrl }}
                      style={{ width: 40, height: 40, borderRadius: themeTokens.radius.sm }}
                    />
                  ) : (
                    <FolderKanban color="#FFFFFF" size={20} />
                  )}
                </View>
                <AppText accessibilityRole="header" variant="label">
                  Project overview
                </AppText>
              </View>
              {project.description ? (
                <AppText tone="secondary">{project.description}</AppText>
              ) : (
                <AppText tone="secondary">No description provided.</AppText>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.xs }}>
                <View
                  style={{
                    borderRadius: themeTokens.radius.pill,
                    backgroundColor: colors.primarySurface,
                    paddingHorizontal: themeTokens.spacing.sm,
                    paddingVertical: 6,
                  }}
                >
                  <AppText tone="link" variant="caption">
                    {PROJECT_STATUS_LABELS[project.status]}
                  </AppText>
                </View>
                {project.team?.name ? (
                  <View
                    style={{
                      borderRadius: themeTokens.radius.pill,
                      backgroundColor: colors.surfaceSubtle,
                      paddingHorizontal: themeTokens.spacing.sm,
                      paddingVertical: 6,
                    }}
                  >
                    <AppText tone="secondary" variant="caption">
                      {project.team.name}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <View style={{ gap: themeTokens.spacing.xs }}>
                {[
                  { label: 'Start date', value: dateLabel(project.startDate) },
                  { label: 'Due date', value: dateLabel(deadline) },
                ]
                  .filter((item) => item.value)
                  .map((item) => (
                    <View
                      key={item.label}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: themeTokens.spacing.xs,
                      }}
                    >
                      <CalendarDays color={colors.textMuted} size={16} />
                      <AppText tone="secondary" variant="caption">
                        {item.label}: {item.value}
                      </AppText>
                    </View>
                  ))}
              </View>
              {owner && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: themeTokens.spacing.xs,
                  }}
                >
                  <UserAvatar name={memberName(owner)} size={30} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="caption">{memberName(owner)}</AppText>
                    <AppText tone="secondary" variant="caption">
                      {project.leadId ? 'Project lead' : 'Project owner'}
                    </AppText>
                  </View>
                </View>
              )}
            </AppCard>

            {current?.tasks && current.tasks.length > 0 && (
              <AppCard padding="md" style={{ gap: themeTokens.spacing.sm, borderWidth: 0 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <AppText accessibilityRole="header" variant="label">
                    Task progress
                  </AppText>
                  <AppText tone="secondary" variant="caption">
                    {completedTasks} of {tasks.length} complete
                  </AppText>
                </View>
                <View
                  accessibilityLabel={`${completionPercent}% of project tasks completed`}
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: completionPercent }}
                  style={{
                    height: 8,
                    overflow: 'hidden',
                    borderRadius: themeTokens.radius.pill,
                    backgroundColor: colors.surfaceSubtle,
                  }}
                >
                  <View
                    style={{
                      width: `${completionPercent}%`,
                      height: '100%',
                      borderRadius: themeTokens.radius.pill,
                      backgroundColor: colors.primaryAction,
                    }}
                  />
                </View>
              </AppCard>
            )}
            {current?.taskError && (
              <InlineError
                message={current.taskError}
                onRetry={() => setRetry((value) => value + 1)}
                retryLabel="Retry loading project tasks"
              />
            )}
          </View>
        )}

        {section === 'tasks' && (
          <View style={{ gap: themeTokens.spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <AppText accessibilityRole="header" variant="label">
                Project tasks
              </AppText>
              {canAddTask && (
                <AppButton
                  accessibilityLabel="Add task to project"
                  icon={<Plus color={colors.onPrimary} size={16} />}
                  onPress={() =>
                    router.push(
                      `/task-create?projectId=${encodeURIComponent(project.id)}&teamId=${encodeURIComponent(permissions?.permissions.assign_workspace_members ? (project.teamId ?? '') : '')}&returnToProject=1`,
                    )
                  }
                  style={{ minHeight: 40 }}
                >
                  Add Task
                </AppButton>
              )}
            </View>
            {current?.taskError ? (
              <InlineError
                message={current.taskError}
                onRetry={() => setRetry((value) => value + 1)}
                retryLabel="Retry loading project tasks"
              />
            ) : tasks.length ? (
              tasks.map((task) => {
                const assignee = taskAssignee(task);
                const due = dateLabel(task.deadline);
                return (
                  <AppCard
                    accessibilityLabel={`Open task ${task.title}`}
                    key={task.id}
                    onPress={() => openProjectTask(task)}
                    padding="sm"
                    style={{ gap: themeTokens.spacing.xxs, borderWidth: 0 }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: themeTokens.spacing.xs,
                      }}
                    >
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
                    {(assignee || due) && (
                      <AppText numberOfLines={1} tone="subtle" variant="caption">
                        {[assignee, due ? `Due ${due}` : null].filter(Boolean).join(' · ')}
                      </AppText>
                    )}
                  </AppCard>
                );
              })
            ) : current ? (
              <AppText tone="secondary">No tasks are linked to this project yet.</AppText>
            ) : (
              <LoadingState label="Loading project tasks" />
            )}
          </View>
        )}

        {section === 'members' && (
          <View style={{ gap: themeTokens.spacing.sm }}>
            <AppText accessibilityRole="header" variant="label">
              Project members
            </AppText>
            {current?.memberError ? (
              <InlineError
                message={current.memberError}
                onRetry={() => setRetry((value) => value + 1)}
                retryLabel="Retry loading project members"
              />
            ) : activeMembers.length ? (
              activeMembers.map((member) => (
                <AppCard
                  key={member.id}
                  padding="sm"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: themeTokens.spacing.sm,
                    borderWidth: 0,
                  }}
                >
                  <UserAvatar
                    imageUrl={member.profilePictureUrl}
                    name={memberName(member)}
                    size={38}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText variant="label">{memberName(member)}</AppText>
                    <AppText tone="secondary" variant="caption">
                      {labelFor(member.role)}
                    </AppText>
                  </View>
                  <AppText tone="subtle" variant="caption">
                    {initialsFor(member)}
                  </AppText>
                </AppCard>
              ))
            ) : current ? (
              <AppText tone="secondary">No active members are listed for this project.</AppText>
            ) : (
              <LoadingState label="Loading project members" />
            )}
          </View>
        )}

        {section === 'files' && (
          <View style={{ gap: themeTokens.spacing.sm }}>
            <View style={{ gap: themeTokens.spacing.xs }}>
              <AppText accessibilityRole="header" variant="label">
                Project files
              </AppText>
              {fileListing && (
                <ScrollView
                  contentContainerStyle={{
                    alignItems: 'center',
                    flexDirection: 'row',
                    gap: themeTokens.spacing.xs,
                  }}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {fileListing.breadcrumbs.map((crumb, index) => (
                    <Pressable
                      accessibilityLabel={`Open folder ${crumb.name}`}
                      accessibilityRole="button"
                      key={crumb.id}
                      onPress={() => selectFolder(index === 0 ? undefined : crumb.id)}
                      style={{ minHeight: 40, justifyContent: 'center' }}
                    >
                      <AppText tone="link" variant="caption">
                        {crumb.name}
                      </AppText>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
            {fileError ? (
              <InlineError
                message={fileError}
                onRetry={() => setFileRetry((value) => value + 1)}
                retryLabel="Retry loading project files"
              />
            ) : filesLoading && !fileListing ? (
              <LoadingState label="Loading project files" />
            ) : fileListing ? (
              <>
                {fileListing.folders.map((folder) => (
                  <AppCard
                    accessibilityLabel={`Open folder ${folder.name}`}
                    key={folder.id}
                    onPress={() => selectFolder(folder.id)}
                    padding="sm"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: themeTokens.spacing.sm,
                      borderWidth: 0,
                    }}
                  >
                    <Folder color={colors.primaryAction} size={18} />
                    <AppText numberOfLines={1} style={{ flex: 1 }} variant="label">
                      {folder.name}
                    </AppText>
                    <ChevronRight color={colors.textMuted} size={18} />
                  </AppCard>
                ))}
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.sm }}
                >
                  {fileListing.files.map((file) => (
                    <ProjectFileCard
                      collection={JSON.stringify(
                        fileListing.files.map((item) => ({
                          id: item.id,
                          fileName: item.fileName,
                          fileType: item.fileType,
                        })),
                      )}
                      file={file}
                      key={file.id}
                      projectId={project.id}
                      workspaceId={workspaceId ?? ''}
                    />
                  ))}
                </View>
                {!fileListing.files.length && !fileListing.folders.length && (
                  <AppText tone="secondary">This project folder is empty.</AppText>
                )}
              </>
            ) : null}
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}
