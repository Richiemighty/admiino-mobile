import { router, useFocusEffect, usePreventRemove } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import {
  AppButton,
  AppCard,
  AppInput,
  AppScreen,
  AppText,
  IconButton,
  InlineError,
  LoadingState,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import {
  TASK_PRIORITIES,
  type CreateTaskInput,
  type TaskAccess,
  type TaskMemberOption,
  type TaskPriority,
  type TaskProjectOption,
  type TaskRecord,
  type TaskTeamOption,
  taskService,
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
  const assignees =
    task.assignees?.length ? task.assignees : task.assignee ? [task.assignee] : [];
  const deadlineDate = task.deadline ? new Date(task.deadline) : null;
  const deadline =
    task.deadline && /^\d{4}-\d{2}-\d{2}$/.test(task.deadline)
      ? task.deadline
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

function failureMessage(error: unknown): string {
  if (error instanceof ApiNetworkError)
    return 'You appear to be offline. Reconnect and try again.';
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
          {selectedLabels || 'Optional'}
        </AppText>
      </Pressable>
      <Modal
        accessibilityViewIsModal
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: '#00000066',
          }}
        >
          <View
            style={{
              maxHeight: '80%',
              gap: themeTokens.spacing.md,
              padding: themeTokens.spacing.lg,
              borderTopLeftRadius: themeTokens.radius.lg,
              borderTopRightRadius: themeTokens.radius.lg,
              backgroundColor: colors.surface,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
                {label}
              </AppText>
              <AppButton
                accessibilityLabel={multiple ? `Finish selecting ${label.toLowerCase()}` : 'Close'}
                onPress={() => setVisible(false)}
                variant="ghost"
              >
                {multiple ? 'Done' : 'Close'}
              </AppButton>
            </View>
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
            <ScrollView keyboardShouldPersistTaps="handled">
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
        </View>
      </Modal>
    </>
  );
}

export function TaskFormScreen({
  mode,
  taskId,
  projectId,
}: TaskFormScreenProps) {
  const {
    activeWorkspace,
    permissions,
    status,
    user,
    workspacePermissionStatus,
    logout,
  } = useAuth();
  const { colors } = useAppTheme();
  const workspaceId = activeWorkspace?.companyId ?? null;
  const role = permissions?.role ?? '';
  const roleCanCreate = ['owner', 'admin', 'manager', 'member'].includes(role);
  const projectContext = mode === 'create' && Boolean(projectId);
  const createPermission = projectContext ? 'create_project_tasks' : 'create_tasks';
  const canCreate =
    mode === 'create' &&
    roleCanCreate &&
    permissions?.permissions[createPermission] === true;
  const canEditTaskFields =
    mode === 'edit' &&
    role !== 'member' &&
    workspacePermissionStatus === 'ready';
  const isReady =
    status === 'authenticated' &&
    workspacePermissionStatus === 'ready' &&
    Boolean(activeWorkspace && workspaceId);
  const [form, setForm] = useState<TaskFormValues>({
    ...EMPTY_FORM,
    ...(projectId ? { projectId } : {}),
  });
  const [initialForm, setInitialForm] = useState<TaskFormValues>({
    ...EMPTY_FORM,
    ...(projectId ? { projectId } : {}),
  });
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [taskAccess, setTaskAccess] = useState<TaskAccess | null>(null);
  const [taskLoading, setTaskLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; deadline?: string }>({});
  const [projects, setProjects] = useState<TaskProjectOption[]>([]);
  const [teams, setTeams] = useState<TaskTeamOption[]>([]);
  const [members, setMembers] = useState<TaskMemberOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsRetry, setOptionsRetry] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [discardConfirmed, setDiscardConfirmed] = useState(false);
  const submittingRef = useRef(false);
  const initialWorkspaceId = useRef<string | null>(null);
  const workspaceChanged =
    initialWorkspaceId.current !== null && initialWorkspaceId.current !== workspaceId;

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

  useEffect(() => {
    if (!isReady || !workspaceId) return;
    if (initialWorkspaceId.current === null) {
      initialWorkspaceId.current = workspaceId;
      return;
    }
    if (initialWorkspaceId.current !== workspaceId) {
      setTask(null);
      setTaskAccess(null);
      setProjects([]);
      setTeams([]);
      setMembers([]);
      router.replace('/(tabs)/tasks');
    }
  }, [isReady, workspaceId]);

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
          if (!response.access.canEdit || response.access.readOnly || role === 'member') {
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
    }, [isReady, logout, mode, role, taskId, workspaceId]),
  );

  useEffect(() => {
    if (mode !== 'create' || !isReady || !workspaceId) return;
    const controller = new AbortController();
    setOptionsLoading(true);
    setOptionsError(null);
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
              setOptionsError('Workspace members could not be loaded. You can still create an unassigned task.');
            }
          }),
      );
    }
    void Promise.all(requests).finally(() => {
      if (!controller.signal.aborted) setOptionsLoading(false);
    });
    return () => controller.abort();
  }, [canAssignOthers, isReady, mode, optionsRetry, showTeamPicker, workspaceId]);

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
  const uniqueAssigneeOptions = [...new Map(assigneeOptions.map((item) => [item.userId, item])).values()];

  const updateForm = (changes: Partial<TaskFormValues>) => {
    setForm((current) => ({ ...current, ...changes }));
    setFieldErrors({});
    setSaveError(null);
  };

  const cancel = () => {
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
            else router.replace('/(tabs)/tasks');
          },
        },
      ]);
    } else if (router.canGoBack()) {
      router.back();
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
        ? new Date(`${form.deadline}T00:00:00`).toISOString()
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
        router.replace(`/tasks/${encodeURIComponent(created.id)}`);
      } else {
        if (!taskId || !taskAccess || !canEditTaskFields) {
          throw new ApiError('You do not have permission to edit this task.', 403);
        }
        const input: UpdateTaskInput = {
          title,
          description: form.description.trim(),
          priority: form.priority,
          deadline,
        };
        const updated = await taskService.updateTask(
          taskId,
          workspaceId,
          input,
          taskAccess,
        );
        setTask(updated);
        setInitialForm(form);
        setDiscardConfirmed(true);
        router.replace(`/tasks/${encodeURIComponent(updated.id)}`);
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
  if (workspaceChanged) {
    return (
      <AppScreen>
        <LoadingState label="Returning to Tasks after workspace switch" variant="fullScreen" />
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
            accessibilityLabel="Back to Tasks"
            onPress={() => router.replace('/(tabs)/tasks')}
            variant="outline"
          >
            Back to Tasks
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
            onPress={() => taskId && router.replace(`/tasks/${encodeURIComponent(taskId)}`)}
          />
          {loadError ? (
            <InlineError message={loadError} />
          ) : (
            <AppText tone="secondary">
              You do not have permission to edit this task.
            </AppText>
          )}
        </View>
      </AppScreen>
    );
  }

  const projectOptions = projects.map((project) => ({ id: project.id, label: project.name }));
  const teamOptions = teams.map((team) => ({ id: team.id, label: team.name }));
  const memberOptions = uniqueAssigneeOptions.map((member) => ({
    id: member.userId,
    label:
      member.userId === user?.id
        ? `${optionLabel(member)} (you)`
        : optionLabel(member),
  }));
  const assigneeLabels = new Map(memberOptions.map((option) => [option.id, option.label]));

  return (
    <AppScreen keyboardAvoiding padding="md" scrollable>
      <View
        style={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          gap: themeTokens.spacing.md,
          paddingBottom: themeTokens.spacing.xl,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
          <IconButton
            accessibilityLabel="Cancel task changes"
            icon={<ArrowLeft color={colors.text} size={22} />}
            onPress={cancel}
          />
          <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
            {mode === 'create' ? 'Create task' : 'Edit task'}
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
          inputStyle={{ minHeight: 100, textAlignVertical: 'top' }}
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
                    backgroundColor: selected ? colors.primarySurface : colors.surface,
                    borderWidth: selected ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <AppText tone={selected ? 'link' : 'secondary'} variant="caption">
                    {priority.replace(/\b\w/g, (letter) => letter.toUpperCase())}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <AppInput
          autoCapitalize="none"
          error={fieldErrors.deadline}
          hint="Optional. Use YYYY-MM-DD."
          label="Deadline"
          onChangeText={(value) => updateForm({ deadline: value })}
          placeholder="2026-12-31"
          value={form.deadline}
        />

        {mode === 'create' && (
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
            {!canAssignOthers && (
              <AppText tone="secondary" variant="caption">
                You can assign this task to yourself. Assigning other workspace members is not permitted.
              </AppText>
            )}
            {optionsLoading && <LoadingState label="Loading task options" />}
            {optionsError && (
              <InlineError
                message={optionsError}
                onRetry={() => setOptionsRetry((value) => value + 1)}
                retryLabel="Retry loading task options"
              />
            )}
          </>
        )}

        <AppCard style={{ gap: themeTokens.spacing.xs }}>
          <AppText variant="caption">
            Task creation and updates are validated by the active workspace backend.
          </AppText>
          {mode === 'create' && form.projectId && (
            <AppText tone="secondary" variant="caption">
              Project: {projects.find((item) => item.id === form.projectId)?.name ?? 'Selected project'}
            </AppText>
          )}
          {mode === 'create' && form.teamId && (
            <AppText tone="secondary" variant="caption">
              Team: {teams.find((item) => item.id === form.teamId)?.name ?? 'Selected team'}
            </AppText>
          )}
          {mode === 'create' && form.assigneeIds.length > 0 && (
            <AppText tone="secondary" variant="caption">
              Assignees: {form.assigneeIds.map((id) => assigneeLabels.get(id) ?? 'Workspace member').join(', ')}
            </AppText>
          )}
        </AppCard>

        <View style={{ flexDirection: 'row', gap: themeTokens.spacing.sm }}>
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
            {mode === 'create' ? 'Create task' : 'Save changes'}
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}
