import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router, useFocusEffect, usePreventRemove } from 'expo-router';
import { ArrowLeft, CalendarDays, ChevronDown, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import {
  AppButton,
  AppInput,
  AppScreen,
  AppText,
  BottomSheet,
  IconButton,
  InlineError,
  LoadingState,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import {
  type CreateTaskInput,
  TASK_PRIORITIES,
  type TaskAccess,
  type TaskMemberOption,
  type TaskPriority,
  type TaskProjectOption,
  type TaskRecord,
  taskService,
  type TaskTeamOption,
  type UpdateTaskInput,
} from './service';

type FormMode = 'create' | 'edit';

interface TaskFormValues {
  title: string;
  description: string;
  priority: TaskPriority;
  deadline: string;
  assigneeIds: string[];
  projectId: string;
  teamId: string;
}

interface TaskFormScreenProps {
  mode: FormMode;
  taskId?: string;
  projectId?: string;
  teamId?: string;
  returnToProject?: boolean;
  returnProjectId?: string;
}

interface ChoiceOption {
  id: string;
  label: string;
}

const EMPTY_FORM: TaskFormValues = {
  title: '',
  description: '',
  priority: 'medium',
  deadline: '',
  assigneeIds: [],
  projectId: '',
  teamId: '',
};

function formValuesForTask(task: TaskRecord): TaskFormValues {
  const assignees = task.assignees?.length ? task.assignees : task.assignee ? [task.assignee] : [];
  const datePrefix = task.deadline?.match(/^\d{4}-\d{2}-\d{2}(?=$|T)/)?.[0];
  const deadlineDate = task.deadline ? new Date(task.deadline) : null;
  const deadline =
    datePrefix && validDate(datePrefix)
      ? datePrefix
      : deadlineDate && !Number.isNaN(deadlineDate.getTime())
        ? `${deadlineDate.getFullYear()}-${String(deadlineDate.getMonth() + 1).padStart(2, '0')}-${String(deadlineDate.getDate()).padStart(2, '0')}`
        : '';
  return {
    title: task.title,
    description: task.description ?? '',
    priority: task.priority ?? 'medium',
    deadline,
    assigneeIds: assignees.map((person) => person.id),
    projectId: task.projectId ?? '',
    teamId: task.teamId ?? '',
  };
}

function optionLabel(person: TaskMemberOption): string {
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || 'Workspace member';
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateFromString(value: string): Date | null {
  if (!validDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateStringFor(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function displayDate(value: string): string {
  const date = dateFromString(value);
  return date
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
    : 'Select date';
}

function failureMessage(error: unknown): string {
  if (error instanceof ApiNetworkError) return 'You appear to be offline. Reconnect and try again.';
  if (error instanceof ApiTimeoutError) return 'The request timed out. Please try again.';
  if (error instanceof ApiError && error.status === 401)
    return 'Your session has expired. Sign in again to continue.';
  if (error instanceof ApiError && error.status === 403)
    return 'You do not have permission to make this change.';
  if (error instanceof ApiError && error.status === 423)
    return 'This workspace is temporarily suspended.';
  if (error instanceof ApiError && error.status === 409)
    return 'This task changed elsewhere. Reload it and try again.';
  if (error instanceof Error && error.message) return error.message;
  return 'The task could not be saved. Please try again.';
}

function ChoiceField({
  label,
  options,
  selectedIds,
  onChange,
  multiple = false,
  disabled = false,
}: {
  label: string;
  options: ChoiceOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const selectedLabels = options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => option.label)
    .join(', ');
  const selectedCount = selectedIds.length;
  const selectionSummary = multiple
    ? selectedCount === 1
      ? selectedLabels
      : selectedCount > 1
        ? `${selectedCount} selected`
        : ''
    : selectedLabels;
  const visibleOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  return (
    <>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setVisible(true)}
        style={{
          minHeight: themeTokens.touchTarget.minimum,
          justifyContent: 'center',
          gap: themeTokens.spacing.xxs,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: themeTokens.radius.sm,
          paddingHorizontal: themeTokens.spacing.md,
          backgroundColor: disabled ? colors.surfaceSubtle : colors.surface,
        }}
      >
        <AppText variant="label">{label}</AppText>
        <AppText numberOfLines={1} tone="secondary" variant="caption">
          {selectionSummary || 'Optional'}
        </AppText>
      </Pressable>
      <BottomSheet
        footer={
          multiple ? (
            <AppButton
              accessibilityLabel={`Finish selecting ${label.toLowerCase()}`}
              onPress={() => setVisible(false)}
              style={{ marginTop: themeTokens.spacing.md }}
              variant="primary"
            >
              Done
            </AppButton>
          ) : undefined
        }
        onClose={() => setVisible(false)}
        title={label}
        visible={visible}
      >
        <View style={{ gap: themeTokens.spacing.sm }}>
          {options.length > 5 && (
            <TextInput
              accessibilityLabel={`Search ${label.toLowerCase()}`}
              onChangeText={setSearch}
              placeholder={`Search ${label.toLowerCase()}`}
              placeholderTextColor={colors.textMuted}
              style={{
                minHeight: themeTokens.touchTarget.minimum,
                color: colors.text,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: themeTokens.radius.sm,
                paddingHorizontal: themeTokens.spacing.md,
              }}
              value={search}
            />
          )}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 360 }}
          >
            <View style={{ gap: themeTokens.spacing.xs }}>
              {!multiple && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange([]);
                    setVisible(false);
                  }}
                  style={{ minHeight: themeTokens.touchTarget.minimum, justifyContent: 'center' }}
                >
                  <AppText tone="secondary">None</AppText>
                </Pressable>
              )}
              {visibleOptions.map((option) => {
                const selected = selectedIds.includes(option.id);
                return (
                  <Pressable
                    accessibilityLabel={`${selected ? 'Remove' : 'Select'} ${option.label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.id}
                    onPress={() => {
                      if (multiple) {
                        onChange(
                          selected
                            ? selectedIds.filter((id) => id !== option.id)
                            : [...selectedIds, option.id],
                        );
                      } else {
                        onChange([option.id]);
                        setVisible(false);
                      }
                    }}
                    style={{
                      minHeight: themeTokens.touchTarget.minimum,
                      justifyContent: 'center',
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <AppText tone={selected ? 'link' : 'primary'}>{option.label}</AppText>
                  </Pressable>
                );
              })}
              {visibleOptions.length === 0 && (
                <AppText tone="secondary">No matching options.</AppText>
              )}
            </View>
          </ScrollView>
        </View>
      </BottomSheet>
    </>
  );
}

function DatePickerField({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const { colors, resolvedMode } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(dateFromString(value) ?? new Date());

  const open = () => {
    setDraftDate(dateFromString(value) ?? new Date());
    setVisible(true);
  };

  return (
    <>
      <View style={{ gap: themeTokens.spacing.xxs }}>
        <AppText variant="label">Due date</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.xs }}>
          <Pressable
            accessibilityLabel="Deadline"
            accessibilityRole="button"
            onPress={open}
            style={{
              minHeight: themeTokens.touchTarget.minimum,
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: themeTokens.spacing.sm,
              borderWidth: 1,
              borderColor: error ? colors.semantic.danger.foreground : colors.border,
              borderRadius: themeTokens.radius.sm,
              paddingHorizontal: themeTokens.spacing.md,
              backgroundColor: colors.surface,
            }}
          >
            <CalendarDays color={colors.primaryAction} size={18} />
            <AppText style={{ flex: 1 }} tone={value ? 'primary' : 'secondary'}>
              {value ? displayDate(value) : 'Select date'}
            </AppText>
            <ChevronDown color={colors.textMuted} size={16} />
          </Pressable>
          {value.length > 0 && (
            <Pressable
              accessibilityLabel="Clear deadline"
              accessibilityRole="button"
              onPress={() => onChange('')}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X color={colors.textMuted} size={18} />
            </Pressable>
          )}
        </View>
        {error && (
          <AppText tone="danger" variant="caption">
            {error}
          </AppText>
        )}
      </View>
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
              accessibilityLabel="Cancel date selection"
              onPress={() => setVisible(false)}
              style={{ flex: 1 }}
              variant="outline"
            >
              Cancel
            </AppButton>
            <AppButton
              accessibilityLabel="Confirm selected due date"
              onPress={() => {
                onChange(dateStringFor(draftDate));
                setVisible(false);
              }}
              style={{ flex: 1 }}
              variant="primary"
            >
              Done
            </AppButton>
          </View>
        }
        onClose={() => setVisible(false)}
        title="Due date"
        visible={visible}
      >
        <DateTimePicker
          accentColor={colors.primaryAction}
          display="inline"
          mode="date"
          onValueChange={(_event, date) => setDraftDate(date)}
          presentation="inline"
          testID="task-deadline-picker"
          themeVariant={resolvedMode}
          value={draftDate}
        />
      </BottomSheet>
    </>
  );
}

export function TaskFormScreen({
  mode,
  taskId,
  projectId,
  teamId,
  returnToProject = false,
  returnProjectId,
}: TaskFormScreenProps) {
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.companyId ?? null;
  const previousWorkspaceId = useRef<string | null>(workspaceId);

  useEffect(() => {
    if (previousWorkspaceId.current && workspaceId && previousWorkspaceId.current !== workspaceId) {
      router.replace(returnProjectId || projectId ? '/(tabs)/projects' : '/(tabs)/tasks');
    }
    previousWorkspaceId.current = workspaceId;
  }, [projectId, returnProjectId, workspaceId]);

  return (
    <TaskFormScreenContent
      key={`${workspaceId ?? 'no-workspace'}|${mode}|${taskId ?? ''}|${projectId ?? ''}|${teamId ?? ''}`}
      mode={mode}
      projectId={projectId}
      teamId={teamId}
      returnProjectId={returnProjectId}
      returnToProject={returnToProject}
      taskId={taskId}
    />
  );
}

function TaskFormScreenContent({
  mode,
  taskId,
  projectId,
  teamId,
  returnToProject,
  returnProjectId,
}: TaskFormScreenProps) {
  const { activeWorkspace, permissions, status, user, workspacePermissionStatus, logout } =
    useAuth();
  const { colors } = useAppTheme();
  const workspaceId = activeWorkspace?.companyId ?? null;
  const role = permissions?.role ?? '';
  const roleCanCreate = ['owner', 'admin', 'manager', 'member'].includes(role);
  const projectContext = mode === 'create' && Boolean(projectId);
  const createPermission = projectContext ? 'create_project_tasks' : 'create_tasks';
  const canCreate =
    mode === 'create' && roleCanCreate && permissions?.permissions[createPermission] === true;
  const isReady =
    status === 'authenticated' &&
    workspacePermissionStatus === 'ready' &&
    Boolean(activeWorkspace && workspaceId);
  const [form, setForm] = useState<TaskFormValues>({
    ...EMPTY_FORM,
    ...(projectId ? { projectId } : {}),
    ...(teamId ? { teamId } : {}),
  });
  const [initialForm, setInitialForm] = useState<TaskFormValues>({
    ...EMPTY_FORM,
    ...(projectId ? { projectId } : {}),
    ...(teamId ? { teamId } : {}),
  });
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [taskAccess, setTaskAccess] = useState<TaskAccess | null>(null);
  const canEditTaskFields =
    mode === 'edit' &&
    taskAccess?.canEdit === true &&
    taskAccess.readOnly === false &&
    workspacePermissionStatus === 'ready';
  const [taskLoading, setTaskLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; deadline?: string }>({});
  const [projects, setProjects] = useState<TaskProjectOption[]>([]);
  const [teams, setTeams] = useState<TaskTeamOption[]>([]);
  const [members, setMembers] = useState<TaskMemberOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsRetry, setOptionsRetry] = useState(0);
  const [optionsLoadedKey, setOptionsLoadedKey] = useState('');
  const optionsKey = `${workspaceId ?? ''}|${optionsRetry}`;
  const optionsLoading = isReady && Boolean(workspaceId) && optionsLoadedKey !== optionsKey;
  const [submitting, setSubmitting] = useState(false);
  const [discardConfirmed, setDiscardConfirmed] = useState(false);
  const submittingRef = useRef(false);

  const canAssignOthers =
    permissions?.permissions.assign_workspace_members === true &&
    permissions.permissions.view_workspace_members === true;
  const showTeamPicker = permissions?.permissions.assign_workspace_members === true;
  const formHasChanges =
    form.title !== initialForm.title ||
    form.description !== initialForm.description ||
    form.priority !== initialForm.priority ||
    form.deadline !== initialForm.deadline ||
    form.projectId !== initialForm.projectId ||
    form.teamId !== initialForm.teamId ||
    form.assigneeIds.join('|') !== initialForm.assigneeIds.join('|');

  const disablePreventRemove = usePreventRemove(
    formHasChanges && !discardConfirmed && !submitting,
    ({ repeat }) => {
      Alert.alert('Discard changes?', 'Your task changes have not been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setDiscardConfirmed(true);
            repeat();
          },
        },
      ]);
    },
  );

  useFocusEffect(
    useCallback(() => {
      if (mode !== 'edit' || !isReady || !workspaceId || !taskId) return undefined;
      const controller = new AbortController();
      setTaskLoading(true);
      setLoadError(null);
      void taskService
        .getTask(taskId, workspaceId, controller.signal)
        .then((response) => {
          if (controller.signal.aborted) return;
          setTask(response.task);
          setTaskAccess(response.access);
          if (!response.access.canEdit || response.access.readOnly) {
            setLoadError('Task fields cannot be edited with your current task access.');
            return;
          }
          const values = formValuesForTask(response.task);
          setForm(values);
          setInitialForm(values);
        })
        .catch(async (requestError: unknown) => {
          if (controller.signal.aborted) return;
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
            setLoadError(failureMessage(requestError));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setTaskLoading(false);
        });
      return () => controller.abort();
    }, [isReady, logout, mode, taskId, workspaceId]),
  );

  useEffect(() => {
    if (!isReady || !workspaceId) return;
    const controller = new AbortController();
    const requests: Promise<void>[] = [
      taskService
        .getProjects(workspaceId, controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) setProjects(items);
        })
        .catch(() => {
          if (!controller.signal.aborted) setOptionsError('Projects could not be loaded.');
        }),
    ];
    if (showTeamPicker) {
      requests.push(
        taskService
          .getTeams(workspaceId, controller.signal)
          .then((items) => {
            if (!controller.signal.aborted) setTeams(items);
          })
          .catch(() => {
            if (!controller.signal.aborted) setOptionsError('Teams could not be loaded.');
          }),
      );
    }
    if (canAssignOthers) {
      requests.push(
        taskService
          .getMembers(workspaceId, controller.signal)
          .then((items) => {
            if (!controller.signal.aborted) setMembers(items);
          })
          .catch(() => {
            if (!controller.signal.aborted) {
              setOptionsError(
                'Workspace members could not be loaded. You can still create an unassigned task.',
              );
            }
          }),
      );
    }
    void Promise.all(requests).finally(() => {
      if (!controller.signal.aborted) setOptionsLoadedKey(optionsKey);
    });
    return () => controller.abort();
  }, [canAssignOthers, isReady, mode, optionsKey, optionsRetry, showTeamPicker, workspaceId]);

  const selectedTeam = teams.find((team) => team.id === form.teamId);
  const eligibleMembers = selectedTeam
    ? members.filter((member) => selectedTeam.memberIds.includes(member.userId))
    : members;
  const assigneeOptions = (canAssignOthers ? eligibleMembers : []).filter(
    (member) => member.userId !== user?.id,
  );
  if (user?.id && (!selectedTeam || selectedTeam.memberIds.includes(user.id))) {
    assigneeOptions.unshift({
      userId: user.id,
      firstName: user.firstName ?? 'Assign',
      lastName: user.lastName ?? 'to me',
    });
  }
  const uniqueAssigneeOptions = [
    ...new Map(assigneeOptions.map((item) => [item.userId, item])).values(),
  ];

  const updateForm = (changes: Partial<TaskFormValues>) => {
    setForm((current) => ({ ...current, ...changes }));
    setFieldErrors({});
    setSaveError(null);
  };

  const cancel = () => {
    const targetProjectId = returnProjectId ?? projectId;
    if (formHasChanges) {
      Alert.alert('Discard changes?', 'Your task changes have not been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setDiscardConfirmed(true);
            disablePreventRemove();
            if (router.canGoBack()) router.back();
            else if (targetProjectId) {
              router.replace(`/projects/${encodeURIComponent(targetProjectId)}?tab=tasks`);
            } else router.replace('/(tabs)/tasks');
          },
        },
      ]);
    } else if (router.canGoBack()) {
      router.back();
    } else if (targetProjectId) {
      router.replace(`/projects/${encodeURIComponent(targetProjectId)}?tab=tasks`);
    } else {
      router.replace('/(tabs)/tasks');
    }
  };

  const save = async () => {
    if (submittingRef.current || !workspaceId) return;
    const title = form.title.trim();
    const nextFieldErrors: { title?: string; deadline?: string } = {};
    if (!title) nextFieldErrors.title = 'Enter a task title.';
    if (form.deadline && !validDate(form.deadline)) {
      nextFieldErrors.deadline = 'Enter a valid date in YYYY-MM-DD format.';
    }
    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSaveError(null);
    try {
      const deadline = form.deadline
        ? new Date(`${form.deadline}T00:00:00.000Z`).toISOString()
        : mode === 'edit'
          ? null
          : undefined;
      if (mode === 'create') {
        if (!canCreate) throw new ApiError('You do not have permission to create tasks.', 403);
        const input: CreateTaskInput = {
          title,
          description: form.description.trim(),
          priority: form.priority,
          ...(deadline ? { deadline } : {}),
          ...(form.assigneeIds.length ? { assigneeIds: form.assigneeIds } : {}),
          ...(form.projectId ? { projectId: form.projectId } : {}),
          ...(form.teamId ? { teamId: form.teamId } : {}),
        };
        const created = await taskService.createTask(workspaceId, input, projectContext);
        setDiscardConfirmed(true);
        if (projectContext && returnToProject && projectId) {
          router.back();
        } else if (projectContext && projectId) {
          router.replace(`/projects/${encodeURIComponent(projectId)}?tab=tasks`);
        } else {
          router.replace(`/tasks/${encodeURIComponent(created.id)}`);
        }
      } else {
        if (!taskId || !taskAccess || !canEditTaskFields) {
          throw new ApiError('You do not have permission to edit this task.', 403);
        }
        const input: UpdateTaskInput = {
          title,
          description: form.description.trim(),
          priority: form.priority,
          deadline,
          ...(form.assigneeIds.length
            ? { assigneeIds: form.assigneeIds }
            : { clearAssignees: true }),
        };
        const updated = await taskService.updateTask(taskId, workspaceId, input, taskAccess);
        setTask(updated);
        setInitialForm(form);
        setDiscardConfirmed(true);
        const projectParams = returnProjectId
          ? `?projectId=${encodeURIComponent(returnProjectId)}&fromProject=1`
          : '';
        router.replace(`/tasks/${encodeURIComponent(updated.id)}${projectParams}`);
      }
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        try {
          await logout();
          router.replace('/sign-in');
        } catch {
          setSaveError('Your session could not be cleared safely. Please try again.');
        }
      } else if (requestError instanceof ApiError && requestError.status === 423) {
        router.replace('/workspace-suspended');
      } else {
        setSaveError(failureMessage(requestError));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const canShowCreateForm = mode === 'create' && canCreate;
  if (!isReady) {
    return (
      <AppScreen>
        <LoadingState label="Verifying workspace access" variant="fullScreen" />
      </AppScreen>
    );
  }
  if (mode === 'create' && !canShowCreateForm) {
    return (
      <AppScreen scrollable>
        <View style={{ gap: themeTokens.spacing.md }}>
          <AppText accessibilityRole="header" variant="heading">
            Task creation unavailable
          </AppText>
          <AppText tone="secondary">
            You do not have permission to create a task in this workspace.
          </AppText>
          <AppButton
            accessibilityLabel={projectContext ? 'Back to project' : 'Back to Tasks'}
            onPress={() => {
              if (projectContext && projectId) {
                router.replace(`/projects/${encodeURIComponent(projectId)}?tab=tasks`);
              } else {
                router.replace('/(tabs)/tasks');
              }
            }}
            variant="outline"
          >
            {projectContext ? 'Back to project' : 'Back to Tasks'}
          </AppButton>
        </View>
      </AppScreen>
    );
  }
  if (mode === 'edit' && taskLoading) {
    return (
      <AppScreen>
        <LoadingState label="Loading task for editing" variant="fullScreen" />
      </AppScreen>
    );
  }
  if (mode === 'edit' && (loadError || !task || !taskAccess || !canEditTaskFields)) {
    return (
      <AppScreen scrollable>
        <View style={{ gap: themeTokens.spacing.md }}>
          <IconButton
            accessibilityLabel="Back to task"
            icon={<ArrowLeft color={colors.text} size={22} />}
            onPress={() => {
              if (!taskId) return;
              const projectParams = returnProjectId
                ? `?projectId=${encodeURIComponent(returnProjectId)}&fromProject=1`
                : '';
              router.replace(`/tasks/${encodeURIComponent(taskId)}${projectParams}`);
            }}
          />
          {loadError ? (
            <InlineError message={loadError} />
          ) : (
            <AppText tone="secondary">You do not have permission to edit this task.</AppText>
          )}
        </View>
      </AppScreen>
    );
  }

  const projectOptions = projects.map((project) => ({ id: project.id, label: project.name }));
  const teamOptions = teams.map((team) => ({ id: team.id, label: team.name }));
  const memberOptions = uniqueAssigneeOptions.map((member) => ({
    id: member.userId,
    label: member.userId === user?.id ? `${optionLabel(member)} (you)` : optionLabel(member),
  }));
  return (
    <AppScreen keyboardAvoiding padding="md">
      <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
        <ScrollView
          contentContainerStyle={{
            gap: themeTokens.spacing.md,
            paddingBottom: themeTokens.spacing.md,
          }}
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
            <IconButton
              accessibilityLabel="Cancel task changes"
              icon={<ArrowLeft color={colors.text} size={22} />}
              onPress={cancel}
            />
            <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
              {mode === 'create' ? 'Create Task' : 'Edit Task'}
            </AppText>
          </View>

          {loadError && <InlineError message={loadError} />}
          {saveError && <InlineError message={saveError} />}

          <AppInput
            autoCapitalize="sentences"
            error={fieldErrors.title}
            label="Task title"
            onChangeText={(value) => updateForm({ title: value })}
            placeholder="What needs to be done?"
            returnKeyType="next"
            value={form.title}
          />
          <AppInput
            label="Description"
            multiline
            onChangeText={(value) => updateForm({ description: value })}
            placeholder="Add details (optional)"
            value={form.description}
            inputStyle={{ minHeight: 88, textAlignVertical: 'top' }}
          />

          <View style={{ gap: themeTokens.spacing.xs }}>
            <AppText variant="label">Priority</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.xs }}>
              {TASK_PRIORITIES.map((priority) => {
                const selected = form.priority === priority;
                return (
                  <Pressable
                    accessibilityLabel={`Set priority to ${priority}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={priority}
                    onPress={() => updateForm({ priority })}
                    style={{
                      minHeight: themeTokens.touchTarget.minimum,
                      justifyContent: 'center',
                      borderRadius: themeTokens.radius.pill,
                      paddingHorizontal: themeTokens.spacing.md,
                      backgroundColor: selected ? colors.primaryAction : colors.surface,
                      borderWidth: selected ? 0 : 1,
                      borderColor: colors.border,
                    }}
                  >
                    <AppText tone={selected ? 'inverse' : 'secondary'} variant="caption">
                      {priority.replace(/\b\w/g, (letter) => letter.toUpperCase())}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <DatePickerField
            error={fieldErrors.deadline}
            onChange={(deadline) => updateForm({ deadline })}
            value={form.deadline}
          />

          {(mode === 'create' ||
            (mode === 'edit' &&
              canAssignOthers &&
              taskAccess?.canEdit &&
              !taskAccess.readOnly)) && (
            <>
              <ChoiceField
                disabled={projectContext}
                label="Project"
                onChange={(ids) => updateForm({ projectId: ids[0] ?? '' })}
                options={projectOptions}
                selectedIds={form.projectId ? [form.projectId] : []}
              />
              {showTeamPicker && (
                <ChoiceField
                  label="Team"
                  onChange={(ids) => {
                    const teamId = ids[0] ?? '';
                    const team = teams.find((item) => item.id === teamId);
                    updateForm({
                      teamId,
                      assigneeIds: team
                        ? form.assigneeIds.filter((id) => team.memberIds.includes(id))
                        : form.assigneeIds,
                    });
                  }}
                  options={teamOptions}
                  selectedIds={form.teamId ? [form.teamId] : []}
                />
              )}
              <ChoiceField
                label="Assignees"
                multiple
                onChange={(ids) => updateForm({ assigneeIds: ids })}
                options={memberOptions}
                selectedIds={form.assigneeIds}
              />
              {optionsLoading && <LoadingState label="Loading task options" />}
              {optionsError && (
                <InlineError
                  message={optionsError}
                  onRetry={() => {
                    setOptionsError(null);
                    setOptionsRetry((value) => value + 1);
                  }}
                  retryLabel="Retry loading task options"
                />
              )}
            </>
          )}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            gap: themeTokens.spacing.sm,
            paddingTop: themeTokens.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <AppButton
            accessibilityLabel="Cancel"
            disabled={submitting}
            onPress={cancel}
            style={{ flex: 1 }}
            variant="outline"
          >
            Cancel
          </AppButton>
          <AppButton
            accessibilityLabel={mode === 'create' ? 'Save task' : 'Save task changes'}
            disabled={submitting || (mode === 'edit' && !canEditTaskFields)}
            loading={submitting}
            onPress={() => void save()}
            style={{ flex: 1 }}
          >
            {mode === 'create' ? 'Create Task' : 'Save Changes'}
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}
