import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  ChevronRight,
  MessageCircle,
  Paperclip,
  Search,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

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
import { SecureImagePreview } from '../files/SecureImagePreview';
import type { LocalTaskFile } from './fileContracts';
import { isSupportedTaskFile, validateTaskFile } from './fileContracts';
import {
  TASK_STATUSES,
  type TaskAccess,
  type TaskAttachmentRecord,
  type TaskDependencyGraph,
  type TaskDetails,
  type TaskMemberOption,
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

function fileSizeLabel(size: number | null | undefined): string | null {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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

function TaskAttachmentCard({
  attachment,
  taskId,
  workspaceId,
  onOpen,
}: {
  attachment: TaskAttachmentRecord;
  taskId: string;
  workspaceId: string;
  onOpen: () => void;
}) {
  const fileName = attachment.fileName ?? attachment.name ?? 'Task attachment';
  const fileType = attachment.mimeType ?? attachment.fileType ?? '';
  const supported =
    Boolean(attachment.id) &&
    attachment.source !== 'google-drive' &&
    isSupportedTaskFile(fileName, fileType);
  const download = useCallback(
    () =>
      taskService.downloadAttachment(taskId, attachment.id ?? '', workspaceId, attachment.source),
    [attachment.id, attachment.source, taskId, workspaceId],
  );
  const card = (
    <View style={{ gap: themeTokens.spacing.xs }}>
      <SecureImagePreview
        download={download}
        fileName={fileName}
        mimeType={supported ? fileType : 'application/octet-stream'}
        size={attachment.fileSize}
      />
      {attachment.source === 'google-drive' && (
        <AppText tone="warning" variant="caption">
          Open in Google Drive is unavailable in the secure mobile viewer.
        </AppText>
      )}
    </View>
  );
  return supported ? (
    <AppCard
      accessibilityLabel={`Open attachment ${fileName}`}
      onPress={onOpen}
      padding="sm"
      style={{ width: '48%', borderWidth: 0 }}
    >
      {card}
    </AppCard>
  ) : (
    <AppCard padding="sm" style={{ width: '48%', borderWidth: 0 }}>
      {card}
    </AppCard>
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
  returnToInbox = false,
}: {
  taskId: string;
  returnProjectId?: string;
  returnToInbox?: boolean;
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
  const [memberOptions, setMemberOptions] = useState<TaskMemberOption[]>([]);
  const [memberOptionsLoading, setMemberOptionsLoading] = useState(false);
  const [memberOptionsError, setMemberOptionsError] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(new Set());
  const [savingAssignees, setSavingAssignees] = useState(false);
  const [assigneeSaveError, setAssigneeSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<LocalTaskFile | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentUncertain, setAttachmentUncertain] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const currentContext = `${workspaceId ?? ''}:${taskId}`;
  const contextRef = useRef(currentContext);
  const previousAttachmentContext = useRef(currentContext);
  const uncertainUpload = useRef<{
    workspaceId: string;
    taskId: string;
    fileName: string;
    fileSize: number;
    existingAttachmentIds: Set<string>;
  } | null>(null);
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
  const canChangeStatus =
    current?.details.access.canEdit === true && current.details.access.readOnly === false;
  const canManageAssignees =
    canChangeStatus && permissions?.permissions.assign_workspace_members === true;
  const backToContext = () => {
    if (returnToInbox) {
      router.replace('/inbox');
    } else if (returnProjectId) {
      if (router.canGoBack()) router.back();
      else router.replace(`/projects/${encodeURIComponent(returnProjectId)}?tab=tasks`);
    } else {
      router.replace('/(tabs)/tasks');
    }
  };

  useEffect(() => {
    contextRef.current = currentContext;
  }, [currentContext]);

  useEffect(() => {
    const previousContext = previousAttachmentContext.current;
    if (previousContext !== currentContext) {
      if (pendingAttachment) {
        try {
          const file = new File(pendingAttachment.file.uri);
          if (file.exists) file.delete();
        } catch {
          console.warn('Unable to remove a temporary task attachment.');
        }
      }
      setPendingAttachment(null);
      setAttachmentError(null);
      setAttachmentUncertain(false);
      uncertainUpload.current = null;
    }
    previousAttachmentContext.current = currentContext;
  }, [currentContext, pendingAttachment]);

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

  const openAssignees = () => {
    if (!current) return;
    const people = current.details.task.assignees?.length
      ? current.details.task.assignees
      : current.details.task.assignee
        ? [current.details.task.assignee]
        : [];
    setSelectedAssigneeIds(new Set(people.map((person) => person.id)));
    setAssigneeSearch('');
    setAssigneeSaveError(null);
    setMemberOptionsError(null);
    setMemberOptionsLoading(true);
    setAssigneesSheetVisible(true);
  };

  useEffect(() => {
    if (!assigneesSheetVisible || !workspaceId || !canChangeStatus) return undefined;
    const controller = new AbortController();
    void taskService
      .getMembers(workspaceId, controller.signal)
      .then((members) => {
        if (!controller.signal.aborted) setMemberOptions(members);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setMemberOptionsError(
            error instanceof ApiError && error.status === 403
              ? 'You do not have permission to browse workspace members.'
              : 'Workspace members could not be loaded. Try again.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setMemberOptionsLoading(false);
      });
    return () => controller.abort();
  }, [assigneesSheetVisible, canChangeStatus, workspaceId]);

  const saveAssignees = async () => {
    if (!current || savingAssignees || !canChangeStatus) return;
    setSavingAssignees(true);
    setAssigneeSaveError(null);
    try {
      const updatedTask = await taskService.updateTask(
        taskId,
        current.workspaceId,
        { assigneeIds: [...selectedAssigneeIds] },
        current.details.access,
      );
      setLoadedTask({ ...current, details: { ...current.details, task: updatedTask } });
      setAssigneesSheetVisible(false);
      setStatusMessage('Assignees updated.');
    } catch (error) {
      setAssigneeSaveError(
        error instanceof ApiError && error.status === 403
          ? 'You do not have permission to change assignees.'
          : 'Assignees could not be updated. The displayed assignment was not changed.',
      );
    } finally {
      setSavingAssignees(false);
    }
  };

  const selectTaskAttachment = async () => {
    if (uploadingAttachment || attachmentUncertain) return;
    const selectionContext = currentContext;
    setAttachmentError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      const file = new File(asset.uri);
      const mimeType = asset.mimeType ?? file.type ?? '';
      const size = asset.size ?? file.size;
      validateTaskFile(asset.name, mimeType, size);
      if (contextRef.current !== selectionContext) {
        if (file.exists) file.delete();
        return;
      }
      setPendingAttachment({ file, name: asset.name, mimeType, size });
    } catch (error) {
      setAttachmentError(
        error instanceof ApiError
          ? error.message
          : 'The selected file could not be read. Choose it again and retry.',
      );
    }
  };

  const discardTaskAttachment = () => {
    if (!pendingAttachment) return;
    try {
      const file = new File(pendingAttachment.file.uri);
      if (file.exists) file.delete();
    } catch {
      console.warn('Unable to remove a temporary task attachment.');
    }
    setPendingAttachment(null);
    setAttachmentError(null);
    setAttachmentUncertain(false);
    uncertainUpload.current = null;
  };

  const checkTaskAttachmentUpload = async () => {
    const attempt = uncertainUpload.current;
    if (!attempt) return;
    setAttachmentError(null);
    try {
      const latest = await taskService.getTask(attempt.taskId, attempt.workspaceId);
      if (contextRef.current !== `${attempt.workspaceId}:${attempt.taskId}`) return;
      setLoadedTask({ workspaceId: attempt.workspaceId, taskId: attempt.taskId, details: latest });
      const uploaded = latest.task.attachments?.find(
        (attachment) =>
          attachment.id &&
          !attempt.existingAttachmentIds.has(attachment.id) &&
          (attachment.fileName ?? attachment.name) === attempt.fileName &&
          attachment.fileSize === attempt.fileSize,
      );
      if (uploaded) {
        discardTaskAttachment();
        setStatusMessage('Attachment uploaded.');
      } else {
        setAttachmentError(
          'The upload is not listed yet. Refresh again before deciding whether to retry.',
        );
      }
    } catch (error) {
      setAttachmentError(
        error instanceof ApiNetworkError
          ? 'Could not check the attachment list while offline.'
          : 'The attachment list could not be refreshed. Please try again.',
      );
    }
  };

  const uploadTaskAttachment = async () => {
    if (!pendingAttachment || !current || uploadingAttachment || attachmentUncertain) return;
    const uploadContext = `${current.workspaceId}:${current.taskId}`;
    setUploadingAttachment(true);
    setAttachmentError(null);
    setStatusMessage(null);
    const existingAttachmentIds = new Set(
      (current.details.task.attachments ?? [])
        .map((attachment) => attachment.id)
        .filter((id): id is string => Boolean(id)),
    );
    try {
      const uploaded = await taskService.uploadAttachment(
        taskId,
        current.workspaceId,
        pendingAttachment,
        current.details.access,
      );
      if (contextRef.current !== uploadContext) return;
      setLoadedTask((loadedValue) =>
        loadedValue?.workspaceId === current.workspaceId && loadedValue.taskId === taskId
          ? {
              ...loadedValue,
              details: {
                ...loadedValue.details,
                task: {
                  ...loadedValue.details.task,
                  attachments: [...(loadedValue.details.task.attachments ?? []), uploaded],
                },
              },
            }
          : loadedValue,
      );
      discardTaskAttachment();
      setStatusMessage('Attachment uploaded.');
    } catch (error) {
      if (contextRef.current !== uploadContext) return;
      if (
        error instanceof ApiNetworkError ||
        error instanceof ApiTimeoutError ||
        (error instanceof ApiError && error.status >= 500)
      ) {
        uncertainUpload.current = {
          workspaceId: current.workspaceId,
          taskId,
          fileName: pendingAttachment.name,
          fileSize: pendingAttachment.size,
          existingAttachmentIds,
        };
        setAttachmentUncertain(true);
        setAttachmentError(
          'The upload result is uncertain. Check the task attachments before retrying.',
        );
      } else if (error instanceof ApiError && error.status === 401) {
        try {
          await logout();
          router.replace('/sign-in');
        } catch {
          setAttachmentError('Your session could not be cleared safely. Please try again.');
        }
      } else if (error instanceof ApiError && error.status === 423) {
        router.replace('/workspace-suspended');
      } else {
        setAttachmentError(
          error instanceof ApiError
            ? error.message
            : 'The file could not be uploaded. Please try again.',
        );
      }
    } finally {
      if (contextRef.current === uploadContext) setUploadingAttachment(false);
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
  const canAttachFiles = access?.canEdit === true && access.readOnly === false;
  const conversationRoute = {
    pathname: '/tasks/[id]/conversation' as const,
    params: {
      id: task.id,
      ...(returnProjectId ? { projectId: returnProjectId, fromProject: '1' } : {}),
      ...(returnToInbox ? { returnTo: 'inbox' } : {}),
    },
  };
  const openAttachment = (attachment: TaskAttachmentRecord) => {
    const fileName = attachment.fileName ?? attachment.name ?? 'Task attachment';
    const fileType = attachment.mimeType ?? attachment.fileType ?? '';
    if (
      !attachment.id ||
      attachment.source === 'google-drive' ||
      !isSupportedTaskFile(fileName, fileType)
    ) {
      return;
    }
    router.push({
      pathname: '/file-viewer',
      params: {
        taskId: task.id,
        attachmentId: attachment.id,
        fileName,
        fileType,
        fileSize: attachment.fileSize == null ? '' : String(attachment.fileSize),
        source: attachment.source ?? '',
        collection: JSON.stringify(
          attachments
            .filter((item): item is TaskAttachmentRecord & { id: string } => Boolean(item.id))
            .map((item) => ({
              id: item.id,
              fileName: item.fileName ?? item.name ?? 'Task attachment',
              fileType: item.mimeType ?? item.fileType ?? '',
              source: item.source ?? '',
            })),
        ),
        ...(returnProjectId ? { projectId: returnProjectId, fromProject: '1' } : {}),
        ...(returnToInbox ? { returnTo: 'inbox' } : {}),
      },
    });
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

        <Section title="Collaboration">
          <Pressable
            accessibilityLabel="Open task conversation"
            accessibilityRole="button"
            onPress={() => router.push(conversationRoute)}
            style={({ pressed }) => ({
              minHeight: themeTokens.touchTarget.minimum,
              flexDirection: 'row',
              alignItems: 'center',
              gap: themeTokens.spacing.sm,
              borderRadius: themeTokens.radius.md,
              backgroundColor: pressed ? colors.surfaceSubtle : colors.surface,
              paddingHorizontal: themeTokens.spacing.sm,
            })}
          >
            <MessageCircle color={colors.primaryAction} size={19} />
            <View style={{ flex: 1 }}>
              <AppText variant="label">Conversation</AppText>
              <AppText tone="secondary" variant="caption">
                View comments and supporting files
              </AppText>
            </View>
            <ChevronRight color={colors.textMuted} size={18} />
          </Pressable>
        </Section>

        <View style={{ gap: themeTokens.spacing.xs }}>
          <AppText accessibilityRole="header" variant="label">
            Assignees ({assignedPeople.length})
          </AppText>
          {assignedPeople.length > 0 ? (
            <Pressable
              accessibilityLabel={`Show all assignees, ${assignedPeople.length}`}
              accessibilityRole="button"
              onPress={openAssignees}
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
                    <UserAvatar
                      imageUrl={person.profilePictureUrl}
                      name={personName(person)}
                      size={34}
                    />
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
          {canManageAssignees && (
            <AppButton
              accessibilityLabel="Add Assignee"
              icon={<UserPlus color={colors.primaryAction} size={18} />}
              onPress={openAssignees}
              variant="outline"
            >
              Add Assignee
            </AppButton>
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

        {(attachments.length > 0 || canAttachFiles) && (
          <Section title={`Attachments (${attachments.length})`}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.sm }}>
              {attachments.map((attachment, index) => (
                <TaskAttachmentCard
                  attachment={attachment}
                  key={attachment.id ?? `${attachment.fileName ?? attachment.name}-${index}`}
                  onOpen={() => openAttachment(attachment)}
                  taskId={task.id}
                  workspaceId={workspaceId ?? ''}
                />
              ))}
            </View>
            {attachments.length === 0 && (
              <AppText tone="secondary" variant="caption">
                No attachments yet.
              </AppText>
            )}
            {canAttachFiles && !pendingAttachment && (
              <AppButton
                accessibilityLabel="Add task attachment"
                onPress={() => void selectTaskAttachment()}
                variant="outline"
              >
                Add attachment
              </AppButton>
            )}
            {pendingAttachment && (
              <AppCard padding="sm" style={{ gap: themeTokens.spacing.xs }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: themeTokens.spacing.xs,
                  }}
                >
                  <Paperclip color={colors.primaryAction} size={17} />
                  <AppText numberOfLines={1} style={{ flex: 1 }} variant="caption">
                    {pendingAttachment.name} · {fileSizeLabel(pendingAttachment.size)}
                  </AppText>
                  <IconButton
                    accessibilityLabel="Remove selected attachment"
                    disabled={uploadingAttachment || attachmentUncertain}
                    icon={<X color={colors.textMuted} size={18} />}
                    onPress={discardTaskAttachment}
                  />
                </View>
                {attachmentUncertain ? (
                  <AppButton
                    accessibilityLabel="Check task attachment upload status"
                    disabled={uploadingAttachment}
                    onPress={() => void checkTaskAttachmentUpload()}
                    variant="outline"
                  >
                    Check attachment status
                  </AppButton>
                ) : (
                  <AppButton
                    accessibilityLabel="Upload task attachment"
                    disabled={uploadingAttachment}
                    onPress={() => void uploadTaskAttachment()}
                  >
                    {uploadingAttachment ? 'Uploading…' : 'Upload attachment'}
                  </AppButton>
                )}
              </AppCard>
            )}
            {attachmentError && (
              <InlineError
                message={attachmentError}
                onRetry={attachmentUncertain ? () => void checkTaskAttachmentUpload() : undefined}
                retryLabel="Check attachment status"
              />
            )}
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
        footer={
          canManageAssignees ? (
            <View style={{ flexDirection: 'row', gap: themeTokens.spacing.sm }}>
              <AppButton
                accessibilityLabel="Cancel assignee changes"
                onPress={() => setAssigneesSheetVisible(false)}
                style={{ flex: 1 }}
                variant="outline"
              >
                Cancel
              </AppButton>
              <AppButton
                accessibilityLabel="Save assignee changes"
                disabled={savingAssignees}
                loading={savingAssignees}
                onPress={() => void saveAssignees()}
                style={{ flex: 1 }}
              >
                Save Changes
              </AppButton>
            </View>
          ) : undefined
        }
        onClose={() => setAssigneesSheetVisible(false)}
        title={`Assignees (${assignedPeople.length})`}
        visible={assigneesSheetVisible}
      >
        <ScrollView
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 360 }}
        >
          {canManageAssignees ? (
            <View style={{ gap: themeTokens.spacing.sm }}>
              <View
                style={{
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: themeTokens.radius.md,
                  paddingHorizontal: themeTokens.spacing.sm,
                }}
              >
                <Search color={colors.textMuted} size={18} />
                <TextInput
                  accessibilityLabel="Search workspace members"
                  onChangeText={setAssigneeSearch}
                  placeholder="Search members"
                  placeholderTextColor={colors.textMuted}
                  style={{ flex: 1, minHeight: 42, color: colors.text, paddingHorizontal: 8 }}
                  value={assigneeSearch}
                />
              </View>
              {memberOptionsError && <InlineError message={memberOptionsError} />}
              {memberOptionsLoading && <LoadingState label="Loading workspace members" />}
              {!memberOptionsLoading && !memberOptionsError && (
                <View style={{ gap: themeTokens.spacing.xs }}>
                  {memberOptions
                    .filter((member) =>
                      `${member.firstName} ${member.lastName}`
                        .toLowerCase()
                        .includes(assigneeSearch.trim().toLowerCase()),
                    )
                    .map((member) => {
                      const selected = selectedAssigneeIds.has(member.userId);
                      return (
                        <Pressable
                          accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${member.firstName} ${member.lastName}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          key={member.userId}
                          onPress={() =>
                            setSelectedAssigneeIds((currentIds) => {
                              const next = new Set(currentIds);
                              if (selected) next.delete(member.userId);
                              else next.add(member.userId);
                              return next;
                            })
                          }
                          style={{
                            minHeight: 52,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: themeTokens.spacing.sm,
                            paddingHorizontal: themeTokens.spacing.xs,
                          }}
                        >
                          <UserAvatar
                            imageUrl={member.profilePictureUrl}
                            name={`${member.firstName} ${member.lastName}`}
                            size={36}
                          />
                          <View style={{ flex: 1 }}>
                            <AppText variant="label">
                              {member.firstName} {member.lastName}
                            </AppText>
                            <AppText tone="secondary" variant="caption">
                              {selected ? 'Assigned' : 'Not assigned'}
                            </AppText>
                          </View>
                          {selected ? (
                            <UserMinus color={colors.semantic.danger.foreground} size={18} />
                          ) : (
                            <UserPlus color={colors.primaryAction} size={18} />
                          )}
                        </Pressable>
                      );
                    })}
                </View>
              )}
              {assigneeSaveError && <InlineError message={assigneeSaveError} />}
            </View>
          ) : (
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
                  <UserAvatar
                    imageUrl={person.profilePictureUrl}
                    name={personName(person)}
                    size={36}
                  />
                  <AppText variant="label">{personName(person)}</AppText>
                </View>
              ))}
            </View>
          )}
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
