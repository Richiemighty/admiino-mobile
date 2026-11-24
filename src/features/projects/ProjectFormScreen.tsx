import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router, useFocusEffect, usePreventRemove } from 'expo-router';
import { ArrowLeft, CalendarDays, ChevronDown, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

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
import { canCreateProjects, canEditProject } from './permissions';
import {
  PROJECT_STATUSES,
  type ProjectFormInput,
  type ProjectMember,
  type ProjectRecord,
  projectService,
  type ProjectStatus,
} from './service';

type FormMode = 'create' | 'edit';

interface ProjectFormValues {
  name: string;
  description: string;
  startDate: string;
  dueDate: string;
  status: ProjectStatus;
  teamId: string;
}

interface LoadedEditProject {
  workspaceId: string;
  projectId: string;
  project: ProjectRecord;
  members: ProjectMember[];
  memberError: string | null;
}

const EMPTY_FORM: ProjectFormValues = {
  name: '',
  description: '',
  startDate: '',
  dueDate: '',
  status: 'active',
  teamId: '',
};

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateOnly(value: string | null | undefined): string {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
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

function requestErrorMessage(error: unknown, mode: FormMode): string {
  if (error instanceof ApiNetworkError) return 'You appear to be offline. Reconnect and try again.';
  if (error instanceof ApiTimeoutError) return 'The request timed out. Please try again.';
  if (error instanceof ApiError && error.status === 401)
    return 'Your session has expired. Sign in again to continue.';
  if (error instanceof ApiError && error.status === 403) {
    if (error.payload?.code === 'workspace_governance_restricted')
      return 'Project creation is restricted by workspace settings.';
    return mode === 'create'
      ? 'You no longer have permission to create projects.'
      : 'You no longer have permission to edit this project.';
  }
  if (error instanceof ApiError && error.status === 404)
    return 'This project is unavailable or your access has changed.';
  if (error instanceof ApiError && error.status === 400 && error.message) return error.message;
  if (error instanceof ApiError && error.status === 423)
    return 'This workspace is temporarily suspended.';
  return mode === 'create'
    ? 'The project could not be created. Please try again.'
    : 'Project changes could not be saved. Please try again.';
}

function DateField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
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
        <AppText variant="label">{label}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.xs }}>
          <Pressable
            accessibilityLabel={label}
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
              accessibilityLabel={`Clear ${label.toLowerCase()}`}
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
          <AppText accessibilityRole="alert" tone="danger" variant="caption">
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
              accessibilityLabel={`Cancel ${label.toLowerCase()} selection`}
              onPress={() => setVisible(false)}
              style={{ flex: 1 }}
              variant="outline"
            >
              Cancel
            </AppButton>
            <AppButton
              accessibilityLabel={`Confirm ${label.toLowerCase()}`}
              onPress={() => {
                onChange(dateStringFor(draftDate));
                setVisible(false);
              }}
              style={{ flex: 1 }}
            >
              Done
            </AppButton>
          </View>
        }
        onClose={() => setVisible(false)}
        title={label}
        visible={visible}
      >
        <DateTimePicker
          accentColor={colors.primaryAction}
          display="inline"
          mode="date"
          onValueChange={(_event, date) => setDraftDate(date)}
          presentation="inline"
          themeVariant={resolvedMode}
          value={draftDate}
        />
      </BottomSheet>
    </>
  );
}

export function ProjectFormScreen({ mode, projectId }: { mode: FormMode; projectId?: string }) {
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.companyId ?? null;
  const previousWorkspaceId = useRef<string | null>(workspaceId);

  useEffect(() => {
    if (previousWorkspaceId.current && workspaceId && previousWorkspaceId.current !== workspaceId) {
      router.replace('/(tabs)/projects');
    }
    previousWorkspaceId.current = workspaceId;
  }, [workspaceId]);

  return (
    <ProjectFormScreenContent
      key={`${workspaceId ?? 'no-workspace'}|${mode}|${projectId ?? ''}`}
      mode={mode}
      projectId={projectId}
    />
  );
}

function ProjectFormScreenContent({ mode, projectId }: { mode: FormMode; projectId?: string }) {
  const { activeWorkspace, permissions, status, workspacePermissionStatus, logout } = useAuth();
  const { colors } = useAppTheme();
  const workspaceId = activeWorkspace?.companyId ?? null;
  const isReady =
    status === 'authenticated' &&
    workspacePermissionStatus === 'ready' &&
    Boolean(activeWorkspace && workspaceId);
  const canAssignTeam = permissions?.permissions.assign_workspace_members === true;
  const [form, setForm] = useState<ProjectFormValues>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<ProjectFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    startDate?: string;
    dueDate?: string;
  }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editProject, setEditProject] = useState<LoadedEditProject | null>(null);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(mode === 'edit');
  const [retry, setRetry] = useState(0);
  const [governance, setGovernance] = useState<{
    workspaceId: string;
    projectCreationRestricted: boolean;
  } | null>(null);
  const [governanceError, setGovernanceError] = useState<{
    workspaceId: string;
    retry: number;
    message: string;
  } | null>(null);
  const [loadedTeams, setLoadedTeams] = useState<{
    workspaceId: string;
    retry: number;
    teams: { id: string; name: string }[];
  } | null>(null);
  const [teamsError, setTeamsError] = useState<{
    workspaceId: string;
    retry: number;
    message: string;
  } | null>(null);
  const [optionsRetry, setOptionsRetry] = useState(0);
  const [teamSheetVisible, setTeamSheetVisible] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discardConfirmed, setDiscardConfirmed] = useState(false);
  const submittingRef = useRef(false);
  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const currentGovernance = governance?.workspaceId === workspaceId ? governance : null;
  const currentGovernanceError =
    governanceError?.workspaceId === workspaceId && governanceError.retry === retry
      ? governanceError.message
      : null;
  const teamsAreCurrent =
    loadedTeams?.workspaceId === workspaceId && loadedTeams.retry === optionsRetry;
  const teams = teamsAreCurrent ? loadedTeams.teams : [];
  const currentTeamsError =
    teamsError?.workspaceId === workspaceId && teamsError.retry === optionsRetry
      ? teamsError.message
      : null;
  const teamsLoading =
    isReady && canAssignTeam && Boolean(workspaceId) && !teamsAreCurrent && !currentTeamsError;
  const currentEditProject =
    editProject?.workspaceId === workspaceId && editProject.projectId === projectId
      ? editProject
      : null;
  const createAllowed = canCreateProjects(
    permissions,
    currentGovernance
      ? { projectCreationRestricted: currentGovernance.projectCreationRestricted }
      : null,
  );
  const editAllowed =
    mode === 'edit' &&
    currentEditProject !== null &&
    canEditProject(permissions, currentEditProject.members);
  const formHasChanges = JSON.stringify(form) !== JSON.stringify(initialForm);

  const disablePreventRemove = usePreventRemove(
    formHasChanges && !discardConfirmed && !submitting,
    ({ repeat }) => {
      Alert.alert('Discard changes?', 'Your project changes have not been saved.', [
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
    if (
      mode !== 'create' ||
      !isReady ||
      !workspaceId ||
      !permissions ||
      !['owner', 'admin', 'manager', 'member'].includes(permissions.role) ||
      permissions.permissions.create_projects !== true
    ) {
      return undefined;
    }
    const controller = new AbortController();
    void projectService
      .getGovernanceCapabilities(workspaceId, controller.signal)
      .then((capabilities) => {
        if (!controller.signal.aborted) setGovernance({ workspaceId, ...capabilities });
      })
      .catch(async (error: unknown) => {
        if (!controller.signal.aborted) {
          if (error instanceof ApiError && error.status === 401) {
            try {
              await logoutRef.current();
              router.replace('/sign-in');
            } catch {
              setGovernanceError({
                workspaceId,
                retry,
                message: 'Your session could not be cleared safely. Please try again.',
              });
            }
          } else if (error instanceof ApiError && error.status === 423) {
            router.replace('/workspace-suspended');
          } else {
            setGovernanceError({
              workspaceId,
              retry,
              message: requestErrorMessage(error, mode),
            });
          }
        }
      });
    return () => controller.abort();
  }, [isReady, mode, permissions, retry, workspaceId]);

  useEffect(() => {
    if (!isReady || !workspaceId || !canAssignTeam) return undefined;
    const controller = new AbortController();
    void projectService
      .listTeams(workspaceId, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setLoadedTeams({
            workspaceId,
            retry: optionsRetry,
            teams: items.map(({ id, name }) => ({ id, name })),
          });
        }
      })
      .catch(async (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          try {
            await logoutRef.current();
            router.replace('/sign-in');
          } catch {
            setTeamsError({
              workspaceId,
              retry: optionsRetry,
              message: 'Your session could not be cleared safely. Please try again.',
            });
          }
        } else if (error instanceof ApiError && error.status === 423) {
          router.replace('/workspace-suspended');
        } else {
          setTeamsError({
            workspaceId,
            retry: optionsRetry,
            message: requestErrorMessage(error, mode),
          });
        }
      });
    return () => controller.abort();
  }, [canAssignTeam, isReady, mode, optionsRetry, workspaceId]);

  useFocusEffect(
    useCallback(() => {
      if (mode !== 'edit' || !isReady || !workspaceId || !projectId) return undefined;
      const controller = new AbortController();
      const requestRetry = retry;
      setEditLoading(true);
      setEditLoadError(null);
      void projectService
        .getProject(projectId, workspaceId, controller.signal)
        .then(async (project) => {
          const memberResult = await projectService
            .getProjectMembers(projectId, workspaceId, controller.signal)
            .then((members) => ({ members, error: null }))
            .catch((error: unknown) => {
              if (error instanceof ApiError && [401, 423].includes(error.status)) throw error;
              return { members: [], error: 'Project membership could not be verified.' };
            });
          if (controller.signal.aborted || requestRetry !== retry) return;
          const values: ProjectFormValues = {
            name: project.name,
            description: project.description ?? '',
            startDate: dateOnly(project.startDate),
            dueDate: dateOnly(project.dueDate ?? project.endDate),
            status: project.status,
            teamId: project.teamId ?? '',
          };
          setEditProject({
            workspaceId,
            projectId,
            project,
            members: memberResult.members,
            memberError: memberResult.error,
          });
          setForm(values);
          setInitialForm(values);
        })
        .catch(async (error: unknown) => {
          if (controller.signal.aborted || requestRetry !== retry) return;
          if (error instanceof ApiError && error.status === 401) {
            try {
              await logout();
              router.replace('/sign-in');
            } catch {
              setEditLoadError('Your session could not be cleared safely. Please try again.');
            }
          } else if (error instanceof ApiError && error.status === 423) {
            router.replace('/workspace-suspended');
          } else {
            setEditLoadError(requestErrorMessage(error, mode));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted && requestRetry === retry) setEditLoading(false);
        });
      return () => controller.abort();
    }, [isReady, logout, mode, projectId, retry, workspaceId]),
  );

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(teamSearch.trim().toLowerCase()),
  );
  const selectedTeamName =
    teams.find((team) => team.id === form.teamId)?.name ?? currentEditProject?.project.team?.name;

  const updateForm = (changes: Partial<ProjectFormValues>) => {
    setForm((current) => ({ ...current, ...changes }));
    setFieldErrors({});
    setSaveError(null);
  };

  const cancel = () => {
    const leave = () => {
      setDiscardConfirmed(true);
      disablePreventRemove();
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/projects');
    };
    if (formHasChanges) {
      Alert.alert('Discard changes?', 'Your project changes have not been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: leave },
      ]);
    } else {
      leave();
    }
  };

  const validate = (): boolean => {
    const errors: { name?: string; startDate?: string; dueDate?: string } = {};
    if (!form.name.trim()) errors.name = 'Enter a project name.';
    if (form.startDate && !validDate(form.startDate))
      errors.startDate = 'Enter a valid start date.';
    if (form.dueDate && !validDate(form.dueDate)) errors.dueDate = 'Enter a valid due date.';
    if (
      form.startDate &&
      form.dueDate &&
      validDate(form.startDate) &&
      validDate(form.dueDate) &&
      form.dueDate < form.startDate
    ) {
      errors.dueDate = 'Due date cannot be before the start date.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async () => {
    if (submittingRef.current || !workspaceId || !validate()) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSaveError(null);
    try {
      if (mode === 'create') {
        if (!createAllowed) {
          throw new ApiError('You do not have permission to create projects.', 403);
        }
        const input: ProjectFormInput = {
          name: form.name,
          description: form.description,
          startDate: form.startDate || undefined,
          dueDate: form.dueDate || undefined,
          ...(canAssignTeam && form.teamId ? { teamId: form.teamId } : {}),
        };
        const created = await projectService.createProject(workspaceId, input);
        setDiscardConfirmed(true);
        router.replace(`/projects/${encodeURIComponent(created.id)}`);
      } else {
        if (!projectId || !currentEditProject || !editAllowed) {
          throw new ApiError('You do not have permission to edit this project.', 403);
        }
        await projectService.updateProject(projectId, workspaceId, {
          name: form.name,
          description: form.description,
          startDate: form.startDate,
          dueDate: form.dueDate,
          status: form.status,
          ...(canAssignTeam ? { teamId: form.teamId } : {}),
        });
        setDiscardConfirmed(true);
        if (router.canGoBack()) router.back();
        else router.replace(`/projects/${encodeURIComponent(projectId)}`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        try {
          await logout();
          router.replace('/sign-in');
        } catch {
          setSaveError('Your session could not be cleared safely. Please try again.');
        }
      } else if (error instanceof ApiError && error.status === 423) {
        router.replace('/workspace-suspended');
      } else {
        setSaveError(requestErrorMessage(error, mode));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (!isReady) {
    return (
      <AppScreen>
        <LoadingState label="Verifying workspace access" variant="fullScreen" />
      </AppScreen>
    );
  }

  if (
    mode === 'create' &&
    permissions?.permissions.create_projects === true &&
    !currentGovernance
  ) {
    if (currentGovernanceError) {
      return (
        <AppScreen scrollable>
          <View style={{ gap: themeTokens.spacing.md }}>
            <InlineError
              message={currentGovernanceError}
              onRetry={() => setRetry((value) => value + 1)}
              retryLabel="Retry checking project permissions"
            />
          </View>
        </AppScreen>
      );
    }
    return (
      <AppScreen>
        <LoadingState label="Checking project permissions" variant="fullScreen" />
      </AppScreen>
    );
  }

  if (mode === 'create' && !createAllowed) {
    return (
      <AppScreen scrollable>
        <View style={{ gap: themeTokens.spacing.md }}>
          <AppText accessibilityRole="header" variant="heading">
            Project creation unavailable
          </AppText>
          <AppText tone="secondary">
            {currentGovernance?.projectCreationRestricted
              ? 'Project creation is restricted by workspace settings.'
              : 'Your effective workspace permissions do not allow project creation.'}
          </AppText>
          <AppButton
            accessibilityLabel="Back to Projects"
            onPress={() => router.replace('/(tabs)/projects')}
            variant="outline"
          >
            Back to Projects
          </AppButton>
        </View>
      </AppScreen>
    );
  }

  if (mode === 'edit' && editLoading && !currentEditProject) {
    return (
      <AppScreen>
        <LoadingState label="Loading project for editing" variant="fullScreen" />
      </AppScreen>
    );
  }

  if (mode === 'edit' && (editLoadError || !currentEditProject || !editAllowed)) {
    return (
      <AppScreen scrollable>
        <View style={{ gap: themeTokens.spacing.md }}>
          <IconButton
            accessibilityLabel="Back to project"
            icon={<ArrowLeft color={colors.text} size={22} />}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)/projects');
            }}
          />
          {editLoadError ? (
            <InlineError
              message={editLoadError}
              onRetry={() => setRetry((value) => value + 1)}
              retryLabel="Retry loading project"
            />
          ) : (
            <AppText tone="secondary">You do not have permission to edit this project.</AppText>
          )}
        </View>
      </AppScreen>
    );
  }

  return (
    <>
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
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}
            >
              <IconButton
                accessibilityLabel="Cancel project changes"
                icon={<ArrowLeft color={colors.text} size={22} />}
                onPress={cancel}
              />
              <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
                {mode === 'create' ? 'Create Project' : 'Edit Project'}
              </AppText>
            </View>

            {saveError && <InlineError message={saveError} />}
            {mode === 'edit' && currentEditProject?.memberError && (
              <AppText tone="secondary" variant="caption">
                Project membership could not be verified. Only workspace project managers can edit.
              </AppText>
            )}

            <AppInput
              autoCapitalize="sentences"
              error={fieldErrors.name}
              label="Project name"
              onChangeText={(name) => updateForm({ name })}
              placeholder="Name this project"
              returnKeyType="next"
              value={form.name}
            />
            <AppInput
              label="Description"
              multiline
              onChangeText={(description) => updateForm({ description })}
              placeholder="Add project details (optional)"
              value={form.description}
              inputStyle={{ minHeight: 88, textAlignVertical: 'top' }}
            />

            {mode === 'edit' && (
              <View style={{ gap: themeTokens.spacing.xs }}>
                <AppText variant="label">Status</AppText>
                <Pressable
                  accessibilityLabel={`Project status: ${PROJECT_STATUS_LABELS[form.status]}`}
                  accessibilityRole="button"
                  onPress={() => setStatusSheetVisible(true)}
                  style={{
                    minHeight: themeTokens.touchTarget.minimum,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: themeTokens.radius.sm,
                    paddingHorizontal: themeTokens.spacing.md,
                    backgroundColor: colors.surface,
                  }}
                >
                  <AppText style={{ flex: 1 }}>{PROJECT_STATUS_LABELS[form.status]}</AppText>
                  <ChevronDown color={colors.textMuted} size={18} />
                </Pressable>
              </View>
            )}

            <DateField
              error={fieldErrors.startDate}
              label="Start date"
              onChange={(startDate) => updateForm({ startDate })}
              value={form.startDate}
            />
            <DateField
              error={fieldErrors.dueDate}
              label="Due date"
              onChange={(dueDate) => updateForm({ dueDate })}
              value={form.dueDate}
            />

            {canAssignTeam && (
              <View style={{ gap: themeTokens.spacing.xs }}>
                <AppText variant="label">Team</AppText>
                <Pressable
                  accessibilityLabel="Choose project team"
                  accessibilityRole="button"
                  onPress={() => setTeamSheetVisible(true)}
                  style={{
                    minHeight: themeTokens.touchTarget.minimum,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: themeTokens.radius.sm,
                    paddingHorizontal: themeTokens.spacing.md,
                    backgroundColor: colors.surface,
                  }}
                >
                  <AppText style={{ flex: 1 }} tone={selectedTeamName ? 'primary' : 'secondary'}>
                    {selectedTeamName ?? (form.teamId ? 'Current team' : 'No team')}
                  </AppText>
                  <ChevronDown color={colors.textMuted} size={18} />
                </Pressable>
                {currentTeamsError && (
                  <InlineError
                    message={currentTeamsError}
                    onRetry={() => setOptionsRetry((value) => value + 1)}
                    retryLabel="Retry loading teams"
                  />
                )}
              </View>
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
              accessibilityLabel={mode === 'create' ? 'Create project' : 'Save project changes'}
              disabled={submitting || (mode === 'edit' && !editAllowed)}
              loading={submitting}
              onPress={() => void submit()}
              style={{ flex: 1 }}
            >
              {mode === 'create' ? 'Create Project' : 'Save Changes'}
            </AppButton>
          </View>
        </View>
      </AppScreen>

      <BottomSheet
        footer={
          <AppButton
            accessibilityLabel="Clear project team"
            onPress={() => {
              updateForm({ teamId: '' });
              setTeamSheetVisible(false);
            }}
            style={{ marginTop: themeTokens.spacing.md }}
            variant="outline"
          >
            No team
          </AppButton>
        }
        onClose={() => setTeamSheetVisible(false)}
        title="Choose project team"
        visible={teamSheetVisible}
      >
        <AppInput
          autoCapitalize="none"
          label="Search teams"
          onChangeText={setTeamSearch}
          placeholder="Search teams"
          value={teamSearch}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 320, marginTop: themeTokens.spacing.sm }}
        >
          {teamsLoading && <LoadingState label="Loading teams" />}
          {filteredTeams.map((team) => (
            <Pressable
              accessibilityLabel={`Select team ${team.name}`}
              accessibilityRole="button"
              accessibilityState={{ selected: form.teamId === team.id }}
              key={team.id}
              onPress={() => {
                updateForm({ teamId: team.id });
                setTeamSheetVisible(false);
                setTeamSearch('');
              }}
              style={{
                minHeight: themeTokens.touchTarget.minimum,
                justifyContent: 'center',
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <AppText>{team.name}</AppText>
            </Pressable>
          ))}
          {!filteredTeams.length && (
            <AppText style={{ paddingVertical: themeTokens.spacing.md }} tone="secondary">
              No matching teams.
            </AppText>
          )}
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        onClose={() => setStatusSheetVisible(false)}
        title="Project status"
        visible={statusSheetVisible}
      >
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
          {PROJECT_STATUSES.map((statusValue) => (
            <Pressable
              accessibilityLabel={`Set project status to ${PROJECT_STATUS_LABELS[statusValue]}`}
              accessibilityRole="button"
              accessibilityState={{ selected: form.status === statusValue }}
              key={statusValue}
              onPress={() => {
                updateForm({ status: statusValue });
                setStatusSheetVisible(false);
              }}
              style={{
                minHeight: themeTokens.touchTarget.minimum,
                justifyContent: 'center',
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <AppText>{PROJECT_STATUS_LABELS[statusValue]}</AppText>
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
}
