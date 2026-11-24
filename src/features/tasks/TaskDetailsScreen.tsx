import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import {
  AppButton,
  AppCard,
  AppScreen,
  AppText,
  BottomSheet,
  IconButton,
  InlineError,
  LoadingState,
  UserAvatar,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import {
  TASK_STATUSES,
  type TaskAccess,
  type TaskDependencyGraph,
  type TaskDetails,
  type TaskRecord,
  taskService,
  type TaskStatus,
} from './service';

interface LoadedTask {
  workspaceId: string;
  taskId: string;
  details: TaskDetails;
}

interface LoadedDependencies {
  workspaceId: string;
  taskId: string;
  graph: TaskDependencyGraph;
}

function labelFor(value: string | null | undefined): string {
  if (!value) return 'Not set';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function personName(person: TaskRecord['creator']): string {
  return person
    ? [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || 'Workspace member'
    : 'Not assigned';
}

function fullDate(value: string | null | undefined, isDeadline = false): string {
  if (!value) return 'No deadline';
  const dateOnly = isDeadline ? /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value) : null;
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12)
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Deadline unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function taskErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError)
    return 'You appear to be offline. Reconnect and try loading the task again.';
  if (error instanceof ApiTimeoutError) return 'Loading the task took too long. Please try again.';
  if (error instanceof ApiError && error.status === 403)
    return 'You no longer have permission to view this task.';
  if (error instanceof ApiError && error.status === 404)
    return 'This task is unavailable in the active workspace.';
  if (error instanceof ApiError && error.status === 423)
    return 'This workspace is temporarily suspended.';
  return 'Task details could not be loaded. Please try again.';
}

function statusUpdateError(error: unknown): string {
  if (error instanceof ApiNetworkError)
    return 'The status update could not be confirmed because the network is unavailable.';
  if (error instanceof ApiTimeoutError)
    return 'The status update timed out. The displayed status has not been changed.';
  if (
    error instanceof ApiError &&
    (error.status === 400 || error.status === 403 || error.status === 409)
  )
    return 'The server rejected this status change. The displayed status has not been changed.';
  return 'The status could not be updated. The displayed status has not been changed.';
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: themeTokens.spacing.xs }}>
      <AppText accessibilityRole="header" variant="label">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return value ? (
    <View
      style={{
        minHeight: 30,
        flexDirection: 'row',
        alignItems: 'center',
        gap: themeTokens.spacing.sm,
      }}
    >
      <AppText style={{ width: 88 }} tone="secondary" variant="caption">
        {label}
      </AppText>
      <AppText style={{ flex: 1 }} variant="caption">
        {value}
      </AppText>
    </View>
  ) : null;
}

function StatusBadge({ status }: { status: TaskStatus | null }) {
  const { colors } = useAppTheme();
  const tone = status ? themeTokens.taskStatusTone[status] : 'neutral';
  return (
    <View
      style={{
        borderRadius: themeTokens.radius.pill,
        backgroundColor: colors.semantic[tone].background,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <AppText tone={tone === 'neutral' ? 'secondary' : tone} variant="caption">
        {labelFor(status)}
      </AppText>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: TaskRecord['priority'] }) {
  const { colors } = useAppTheme();
  const tone = themeTokens.taskPriorityTone[priority ?? 'medium'];
  return (
    <View
      style={{
        borderRadius: themeTokens.radius.pill,
        backgroundColor: colors.semantic[tone].background,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <AppText tone={tone === 'neutral' ? 'secondary' : tone} variant="caption">
        {labelFor(priority)} priority
      </AppText>
    </View>
  );
}

function StatusOption({
  status,
  onPress,
  disabled,
}: {
  status: TaskStatus;
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={`Set status to ${labelFor(status)}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: themeTokens.touchTarget.minimum,
        justifyContent: 'center',
        borderRadius: themeTokens.radius.pill,
        paddingHorizontal: themeTokens.spacing.md,
        backgroundColor: colors.surfaceSubtle,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <AppText tone="secondary" variant="caption">
        {labelFor(status)}
      </AppText>
    </Pressable>
  );
}

export function TaskDetailsScreen({
  taskId,
  returnProjectId,
}: {
  taskId: string;
  returnProjectId?: string;
}) {
  const { activeWorkspace, permissions, status, workspacePermissionStatus, logout } = useAuth();
  const { colors } = useAppTheme();
  const workspaceId = activeWorkspace?.companyId ?? null;
  const [loadedTask, setLoadedTask] = useState<LoadedTask | null>(null);
  const [loadedDependencies, setLoadedDependencies] = useState<LoadedDependencies | null>(null);
  const [dependenciesError, setDependenciesError] = useState<string | null>(null);
  const [teamLeadLookup, setTeamLeadLookup] = useState<{
    workspaceId: string;
    taskId: string;
    userId: string | null;
  } | null>(null);
  const [teamLeadError, setTeamLeadError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);
  const [assigneesSheetVisible, setAssigneesSheetVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const current =
    loadedTask?.workspaceId === workspaceId && loadedTask.taskId === taskId ? loadedTask : null;
  const currentDependencies =
    loadedDependencies?.workspaceId === workspaceId && loadedDependencies.taskId === taskId
      ? loadedDependencies.graph
      : null;
  const isReady =
    status === 'authenticated' &&
    workspacePermissionStatus === 'ready' &&
    Boolean(activeWorkspace && workspaceId);
  const backToContext = () => {
    if (returnProjectId) {
      if (router.canGoBack()) router.back();
      else router.replace(`/projects/${encodeURIComponent(returnProjectId)}?tab=tasks`);
    } else {
      router.replace('/(tabs)/tasks');
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!isReady || !workspaceId || !taskId) return undefined;
      const controller = new AbortController();
      const requestAttempt = retry;
      request.current?.abort();
      request.current = controller;
      setLoading(true);
      setLoadError(null);
      setStatusError(null);
      setStatusMessage(null);
      setTeamLeadError(null);
      void taskService
        .getTask(taskId, workspaceId, controller.signal)
        .then((details) => {
          if (controller.signal.aborted || requestAttempt !== retry) return;
          setLoadedTask({ workspaceId, taskId, details });
          if (details.task.teamId) {
            void taskService
              .getTeamLead(details.task.teamId, workspaceId, controller.signal)
              .then((userId) => {
                if (!controller.signal.aborted) {
                  setTeamLeadLookup({ workspaceId, taskId, userId });
                }
              })
              .catch(() => {
                if (!controller.signal.aborted) {
                  setTeamLeadLookup({ workspaceId, taskId, userId: null });
                  setTeamLeadError(
                    'Team reviewer access could not be verified. Some status changes are hidden.',
                  );
                }
              });
          } else {
            setTeamLeadLookup({ workspaceId, taskId, userId: null });
          }
          return taskService
            .getDependencies(taskId, workspaceId, controller.signal)
            .then((graph) => {
              if (!controller.signal.aborted) {
                setLoadedDependencies({ workspaceId, taskId, graph });
                setDependenciesError(null);
              }
            })
            .catch((dependencyError: unknown) => {
              if (!controller.signal.aborted) {
                setDependenciesError(
                  dependencyError instanceof ApiNetworkError
                    ? 'Dependencies could not be loaded while offline.'
                    : 'Dependencies are temporarily unavailable.',
                );
              }
            });
        })
        .catch(async (requestError: unknown) => {
          if (controller.signal.aborted || requestAttempt !== retry) return;
          if (requestError instanceof ApiError && requestError.status === 401) {
            try {
              await logout();
              router.replace('/sign-in');
            } catch {
              setLoadError('Your session could not be cleared safely. Please try again.');
            }
          } else if (requestError instanceof ApiError && requestError.status === 423) {
            router.replace('/workspace-suspended');
          } else {
            setLoadError(taskErrorMessage(requestError));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted && requestAttempt === retry) setLoading(false);
        });
      return () => controller.abort();
    }, [isReady, logout, retry, taskId, workspaceId]),
  );

  const changeStatus = async (nextStatus: TaskStatus) => {
    if (!current || updating || nextStatus === current.details.task.status) return;
    setUpdating(true);
    setStatusError(null);
    setStatusMessage(null);
    try {
      const updatedTask = await taskService.updateTask(
        taskId,
        current.workspaceId,
        { status: nextStatus },
        current.details.access,
      );
      setLoadedTask({
        ...current,
        details: { ...current.details, task: updatedTask },
      });
      setStatusMessage(`Status updated to ${labelFor(updatedTask.status)}.`);
    } catch (updateError) {
      if (updateError instanceof ApiError && updateError.status === 401) {
        try {
          await logout();
          router.replace('/sign-in');
        } catch {
          setStatusError('Your session could not be cleared safely. Please try again.');
        }
      } else if (updateError instanceof ApiError && updateError.status === 423) {
        router.replace('/workspace-suspended');
      } else {
        setStatusError(statusUpdateError(updateError));
        if (
          !(updateError instanceof ApiNetworkError) &&
          !(updateError instanceof ApiTimeoutError)
        ) {
          try {
            const latest = await taskService.getTask(taskId, current.workspaceId);
            setLoadedTask({ ...current, details: latest });
          } catch {
            setStatusError(
              `${statusUpdateError(updateError)} The latest task status could not be reloaded.`,
            );
          }
        }
      }
    } finally {
      setUpdating(false);
    }
  };

  if (!isReady || (loading && !current)) {
    return (
      <AppScreen>
        <LoadingState label="Loading task details" variant="fullScreen" />
      </AppScreen>
    );
  }

  const task = current?.details.task;
  const access: TaskAccess | null = current?.details.access ?? null;
  if (!task) {
    return (
      <AppScreen scrollable>
        <View style={{ gap: themeTokens.spacing.md }}>
          <IconButton
            accessibilityLabel={returnProjectId ? 'Back to project' : 'Back to Tasks'}
            icon={<ArrowLeft color={colors.text} size={22} />}
            onPress={backToContext}
          />
          {loadError ? (
            <InlineError
              message={loadError}
              onRetry={() => setRetry((value) => value + 1)}
              retryLabel="Retry loading task"
            />
          ) : (
            <LoadingState label="Loading task details" />
          )}
        </View>
      </AppScreen>
    );
  }

  const canChangeStatus = access?.canEdit === true && access.readOnly === false;
  const isMember = permissions?.role === 'member';
  const canEditFields = canChangeStatus && !isMember;
  const assignedPeople = task.assignees?.length
    ? task.assignees
    : task.assignee
      ? [task.assignee]
      : [];
  const assignedToCurrentUser = assignedPeople.some((person) => person.id === permissions?.userId);
  const isTeamTask = Boolean(task.teamId);
  const teamLeadUserId =
    teamLeadLookup?.workspaceId === workspaceId && teamLeadLookup.taskId === taskId
      ? teamLeadLookup.userId
      : null;
  const isTeamLead = teamLeadUserId === permissions?.userId;
  const teamAssigneeMayNotComplete =
    isTeamTask &&
    assignedToCurrentUser &&
    !['owner', 'admin', 'manager'].includes(permissions?.role ?? '') &&
    task.creator?.id !== permissions?.userId &&
    !isTeamLead;
  const teamAssigneeAwaitingReview = teamAssigneeMayNotComplete && task.status === 'in_review';
  const availableStatuses = task.status
    ? TASK_STATUSES.filter(
        (candidate) =>
          candidate !== task.status &&
          !(task.status === 'in_review' && candidate === 'completed') &&
          !(teamAssigneeMayNotComplete && candidate === 'completed') &&
          !(teamAssigneeAwaitingReview && candidate !== 'pending'),
      )
    : [];
  const activity = [...(task.activities ?? [])].reverse();
  const attachments = task.attachments ?? [];
  const subtasks = task.subtasks ?? [];
  const dependencies = currentDependencies
    ? [...currentDependencies.dependsOn, ...currentDependencies.blocking]
    : [];
  const editRoute = {
    pathname: '/task-edit/[id]' as const,
    params: {
      id: task.id,
      ...(returnProjectId ? { projectId: returnProjectId, fromProject: '1' } : {}),
    },
  };

  return (
    <AppScreen padding="md" scrollable>
      <View
        style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: themeTokens.spacing.md }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
          <IconButton
            accessibilityLabel={returnProjectId ? 'Back to project' : 'Back to Tasks'}
            icon={<ArrowLeft color={colors.text} size={22} />}
            onPress={backToContext}
          />
          <AppText
            accessibilityRole="header"
            numberOfLines={1}
            style={{ flex: 1 }}
            variant="heading"
          >
            Task Details
          </AppText>
          {canEditFields && (
            <AppButton
              accessibilityLabel="Edit task"
              onPress={() => router.push(editRoute)}
              variant="outline"
            >
              Edit
            </AppButton>
          )}
        </View>

        {loadError && (
          <InlineError
            message={loadError}
            onRetry={() => setRetry((value) => value + 1)}
            retryLabel="Refresh task"
          />
        )}

        <AppCard padding="md" style={{ gap: themeTokens.spacing.sm, borderWidth: 0 }}>
          <AppText accessibilityRole="header" variant="heading">
            {task.title}
          </AppText>
          {task.description?.trim() ? (
            <AppText style={{ lineHeight: 22 }} tone="secondary">
              {task.description.trim()}
            </AppText>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: themeTokens.spacing.xs,
            }}
          >
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {canChangeStatus && availableStatuses.length > 0 && (
              <AppButton
                accessibilityLabel="Change status"
                onPress={() => setStatusSheetVisible(true)}
                style={{ minHeight: 36, marginLeft: 'auto' }}
                variant="outline"
              >
                Change status
              </AppButton>
            )}
          </View>
          {task.status === 'in_review' && (
            <AppText accessibilityRole="text" tone="warning" variant="caption">
              Awaiting review
            </AppText>
          )}
        </AppCard>

        <Section title="Task information">
          <AppCard padding="sm" style={{ gap: themeTokens.spacing.xxs, borderWidth: 0 }}>
            <DetailLine label="Due date" value={fullDate(task.deadline, true)} />
            <DetailLine label="Created by" value={personName(task.creator)} />
            <DetailLine label="Project" value={task.project?.name ?? 'No project'} />
            <DetailLine label="Team" value={task.team?.name ?? 'No team'} />
          </AppCard>
        </Section>

        <View style={{ gap: themeTokens.spacing.xs }}>
          <AppText accessibilityRole="header" variant="label">
            Assignees ({assignedPeople.length})
          </AppText>
          {assignedPeople.length > 0 ? (
            <Pressable
              accessibilityLabel={`Show all assignees, ${assignedPeople.length}`}
              accessibilityRole="button"
              onPress={() => setAssigneesSheetVisible(true)}
              style={{
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                gap: themeTokens.spacing.sm,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {assignedPeople.slice(0, 3).map((person, index) => (
                  <View key={person.id} style={{ marginLeft: index === 0 ? 0 : -8 }}>
                    <UserAvatar name={personName(person)} size={34} />
                  </View>
                ))}
                {assignedPeople.length > 3 && (
                  <AppText
                    style={{ marginLeft: themeTokens.spacing.xs }}
                    tone="secondary"
                    variant="caption"
                  >
                    +{assignedPeople.length - 3}
                  </AppText>
                )}
              </View>
              <AppText numberOfLines={1} style={{ flex: 1 }} tone="secondary" variant="caption">
                {assignedPeople.length === 1 ? personName(assignedPeople[0]) : 'View assignees'}
              </AppText>
              <ChevronRight color={colors.textMuted} size={18} />
            </Pressable>
          ) : (
            <AppText tone="secondary" variant="caption">
              Unassigned
            </AppText>
          )}
        </View>

        {statusError && <InlineError message={statusError} />}
        {statusMessage && (
          <AppText accessibilityLiveRegion="polite" tone="success" variant="caption">
            {statusMessage}
          </AppText>
        )}
        {!canChangeStatus && (
          <AppText tone="secondary" variant="caption">
            Status cannot be changed for this task.
          </AppText>
        )}
        {canChangeStatus && availableStatuses.length === 0 && (
          <AppText tone="secondary" variant="caption">
            No status changes are available.
          </AppText>
        )}
        {isMember && canChangeStatus && (
          <AppText tone="secondary" variant="caption">
            Other task details are read-only.
          </AppText>
        )}
        {teamLeadError && (
          <AppText tone="warning" variant="caption">
            Some status changes are unavailable.
          </AppText>
        )}

        {subtasks.length > 0 && (
          <Section title={`Subtasks (${subtasks.length})`}>
            {subtasks.map((subtask) => (
              <Pressable
                accessibilityLabel={`Open subtask ${subtask.title}`}
                accessibilityRole="button"
                key={subtask.id}
                onPress={() => router.push(`/tasks/${encodeURIComponent(subtask.id)}`)}
                style={({ pressed }) => ({
                  minHeight: themeTokens.touchTarget.minimum,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: themeTokens.spacing.sm,
                  paddingHorizontal: themeTokens.spacing.sm,
                  borderRadius: themeTokens.radius.sm,
                  backgroundColor: pressed ? colors.surfaceSubtle : colors.surface,
                })}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{subtask.title}</AppText>
                  <AppText tone="secondary" variant="caption">
                    {labelFor(subtask.status)}
                  </AppText>
                </View>
                <ChevronRight color={colors.textMuted} size={18} />
              </Pressable>
            ))}
          </Section>
        )}

        {(dependenciesError || dependencies.length > 0 || currentDependencies?.isBlocked) && (
          <Section title={`Dependencies${dependencies.length ? ` (${dependencies.length})` : ''}`}>
            {dependenciesError ? (
              <InlineError message={dependenciesError} />
            ) : currentDependencies ? (
              <>
                {currentDependencies.isBlocked && (
                  <AppText tone="warning" variant="caption">
                    Blocked by {currentDependencies.unresolvedDependencyCount} unresolved
                    dependencies.
                  </AppText>
                )}
                {currentDependencies.dependsOn.map((dependency) => (
                  <DependencyRow key={dependency.linkId} dependency={dependency} />
                ))}
                {currentDependencies.blocking.map((dependency) => (
                  <DependencyRow blocking key={dependency.linkId} dependency={dependency} />
                ))}
              </>
            ) : null}
          </Section>
        )}

        {attachments.length > 0 && (
          <Section title={`Attachments (${attachments.length})`}>
            {attachments.map((attachment, index) => (
              <AppCard
                key={attachment.id ?? `${attachment.fileName ?? attachment.name}-${index}`}
                padding="sm"
              >
                <AppText numberOfLines={2} variant="caption">
                  {attachment.fileName ?? attachment.name ?? 'Task attachment'}
                </AppText>
              </AppCard>
            ))}
          </Section>
        )}

        {activity.length > 0 && (
          <Section title={`Recent activity (${activity.length})`}>
            {activity.map((item) => (
              <AppCard key={item.id} padding="sm">
                <AppText variant="caption">
                  {personName(item.actor)} · {labelFor(item.actionType)}
                </AppText>
                <AppText tone="secondary" variant="caption">
                  {fullDate(item.createdAt)}
                </AppText>
              </AppCard>
            ))}
          </Section>
        )}
      </View>
      <BottomSheet
        onClose={() => setStatusSheetVisible(false)}
        title="Change status"
        visible={statusSheetVisible}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.xs }}>
          {availableStatuses.map((value) => (
            <StatusOption
              disabled={updating}
              key={value}
              onPress={() => {
                setStatusSheetVisible(false);
                void changeStatus(value);
              }}
              status={value}
            />
          ))}
        </View>
        {updating && <LoadingState label="Updating task status" />}
      </BottomSheet>
      <BottomSheet
        onClose={() => setAssigneesSheetVisible(false)}
        title={`Assignees (${assignedPeople.length})`}
        visible={assigneesSheetVisible}
      >
        <ScrollView
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 360 }}
        >
          <View style={{ gap: themeTokens.spacing.xs }}>
            {assignedPeople.map((person) => (
              <View
                key={person.id}
                style={{
                  minHeight: 48,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: themeTokens.spacing.sm,
                }}
              >
                <UserAvatar name={personName(person)} size={36} />
                <AppText variant="label">{personName(person)}</AppText>
              </View>
            ))}
          </View>
        </ScrollView>
      </BottomSheet>
    </AppScreen>
  );
}

function DependencyRow({
  dependency,
  blocking = false,
}: {
  dependency: TaskDependencyGraph['dependsOn'][number];
  blocking?: boolean;
}) {
  const { colors } = useAppTheme();
  const relatedTask = dependency.task;
  const title = dependency.restricted ? 'Restricted task' : (relatedTask?.title ?? 'Task');
  const content = (
    <>
      <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
        <AppText variant="label">
          {blocking ? 'Blocks' : 'Depends on'}: {title}
        </AppText>
        <AppText tone="secondary" variant="caption">
          {labelFor(dependency.task?.status ?? dependency.status)}
          {dependency.resolved ? ' · Resolved' : ''}
        </AppText>
      </View>
      {relatedTask && <ChevronRight color={colors.textMuted} size={18} />}
    </>
  );
  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: themeTokens.spacing.sm,
  };
  if (!relatedTask)
    return (
      <AppCard padding="sm" style={style}>
        {content}
      </AppCard>
    );
  return (
    <AppCard
      accessibilityLabel={`Open related task ${title}`}
      onPress={() => router.push(`/tasks/${encodeURIComponent(relatedTask.id)}`)}
      padding="sm"
      style={style}
    >
      {content}
    </AppCard>
  );
}
