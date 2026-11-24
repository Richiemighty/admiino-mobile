import { apiClient, ApiError } from '../../api';
import type { ApiClient } from '../../api/client';
import type { SessionService } from '../../auth/session';
import { sessionService } from '../../auth/session';

export const TASK_STATUSES = [
  'pending',
  'in_progress',
  'in_review',
  'completed',
  'delayed',
  'cancelled',
] as const;

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskRelation = 'assigned' | 'created' | 'all';

export interface TaskPerson {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

export interface TaskRecord {
  id: string;
  companyId: string;
  title: string;
  description?: string | null;
  status: TaskStatus | null;
  priority: TaskPriority | null;
  deadline?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  project?: { id: string; companyId?: string; name: string } | null;
  team?: { id: string; name: string; leadMemberId?: string | null } | null;
  creator?: TaskPerson | null;
  assignee?: TaskPerson | null;
  assignees?: TaskPerson[] | null;
  subtasks?: { id: string; title: string; status: TaskStatus | string }[] | null;
  attachments?:
    | {
        id?: string;
        fileName?: string;
        fileType?: string;
        name?: string;
      }[]
    | null;
  activities?:
    | {
        id: string;
        actionType: string;
        createdAt: string;
        actor?: TaskPerson | null;
      }[]
    | null;
}

export interface TaskAccess {
  canView: boolean;
  canEdit: boolean;
  readOnly: boolean;
}

export interface TaskListItem extends TaskRecord {
  access?: TaskAccess;
}

export interface TaskPage {
  tasks: TaskListItem[];
  total: number;
  page: number;
}

export interface TaskDetails {
  task: TaskRecord;
  access: TaskAccess;
}

export interface TaskDependencyItem {
  linkId: string;
  status: string;
  resolved: boolean;
  restricted: boolean;
  task?: { id: string; title: string; status: string } | null;
}

export interface TaskDependencyGraph {
  dependsOn: TaskDependencyItem[];
  blocking: TaskDependencyItem[];
  isBlocked: boolean;
  unresolvedDependencyCount: number;
  dependsOnCount: number;
  blockingCount: number;
  hasCancelledDependency: boolean;
}

export interface TaskListFilters {
  relation: TaskRelation;
  page: number;
  query?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  canViewAllTasks?: boolean;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  deadline?: string;
  assigneeIds?: string[];
  projectId?: string;
  teamId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  deadline?: string | null;
  status?: TaskStatus;
}

export interface TaskMemberOption {
  userId: string;
  firstName: string;
  lastName: string;
}

export interface TaskProjectOption {
  id: string;
  name: string;
}

export interface TaskTeamOption {
  id: string;
  name: string;
  memberIds: string[];
}

const TASK_PAGE_SIZE = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}

function isTaskPerson(value: unknown): value is TaskPerson {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.firstName === undefined ||
      value.firstName === null ||
      typeof value.firstName === 'string') &&
    (value.lastName === undefined ||
      value.lastName === null ||
      typeof value.lastName === 'string') &&
    (value.email === undefined || value.email === null || typeof value.email === 'string')
  );
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function isTaskAccess(value: unknown): value is TaskAccess {
  return (
    isRecord(value) &&
    typeof value.canView === 'boolean' &&
    typeof value.canEdit === 'boolean' &&
    typeof value.readOnly === 'boolean'
  );
}

function isTaskRecord(value: unknown): value is TaskRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.companyId !== 'string' ||
    typeof value.title !== 'string' ||
    !(value.status === null || isOneOf(value.status, TASK_STATUSES)) ||
    !(value.priority === null || isOneOf(value.priority, TASK_PRIORITIES)) ||
    !isOptionalString(value.description) ||
    !isOptionalString(value.deadline) ||
    !isOptionalString(value.projectId) ||
    !isOptionalString(value.teamId)
  ) {
    return false;
  }

  if (value.creator !== undefined && value.creator !== null && !isTaskPerson(value.creator))
    return false;
  if (value.assignee !== undefined && value.assignee !== null && !isTaskPerson(value.assignee))
    return false;
  if (
    value.assignees !== undefined &&
    value.assignees !== null &&
    (!Array.isArray(value.assignees) || !value.assignees.every(isTaskPerson))
  ) {
    return false;
  }
  if (value.project !== undefined && value.project !== null) {
    if (
      !isRecord(value.project) ||
      typeof value.project.id !== 'string' ||
      typeof value.project.name !== 'string' ||
      !isOptionalString(value.project.companyId)
    ) {
      return false;
    }
  }
  if (value.team !== undefined && value.team !== null) {
    if (
      !isRecord(value.team) ||
      typeof value.team.id !== 'string' ||
      typeof value.team.name !== 'string'
    )
      return false;
  }
  if (
    value.subtasks !== undefined &&
    value.subtasks !== null &&
    (!Array.isArray(value.subtasks) ||
      !value.subtasks.every(
        (subtask) =>
          isRecord(subtask) &&
          typeof subtask.id === 'string' &&
          typeof subtask.title === 'string' &&
          typeof subtask.status === 'string',
      ))
  ) {
    return false;
  }
  if (
    value.attachments !== undefined &&
    value.attachments !== null &&
    (!Array.isArray(value.attachments) ||
      !value.attachments.every(
        (attachment) =>
          isRecord(attachment) &&
          isOptionalString(attachment.id) &&
          isOptionalString(attachment.fileName) &&
          isOptionalString(attachment.fileType) &&
          isOptionalString(attachment.name),
      ))
  ) {
    return false;
  }
  if (
    value.activities !== undefined &&
    value.activities !== null &&
    (!Array.isArray(value.activities) ||
      !value.activities.every(
        (activity) =>
          isRecord(activity) &&
          typeof activity.id === 'string' &&
          typeof activity.actionType === 'string' &&
          typeof activity.createdAt === 'string' &&
          (activity.actor === undefined || activity.actor === null || isTaskPerson(activity.actor)),
      ))
  ) {
    return false;
  }
  return true;
}

function requireSuccess(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!isRecord(value) || value.status !== 'success') throw new ApiError(message, 502);
}

function requireDataRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) throw new ApiError(message, 502);
  return value;
}

function requireWorkspaceTask(task: unknown, workspaceId: string, taskId?: string): TaskRecord {
  if (!isTaskRecord(task)) throw new ApiError('The backend returned an invalid task.', 502);
  if (task.companyId !== workspaceId || (taskId !== undefined && task.id !== taskId)) {
    throw new ApiError('This task is not part of the active workspace.', 404, {
      code: 'TASK_NOT_IN_ACTIVE_WORKSPACE',
    });
  }
  if (task.project?.companyId && task.project.companyId !== workspaceId) {
    throw new ApiError('The task project is not part of the active workspace.', 502);
  }
  return task;
}

function displayName(value: unknown): value is { id: string; name: string; companyId?: string } {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isOptionalString(value.companyId)
  );
}

function isTaskTeam(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.companyId === 'string'
  );
}

export class TaskService {
  constructor(
    private readonly client: ApiClient = apiClient,
    private readonly sessions: SessionService = sessionService,
  ) {}

  async listTasks(
    workspaceId: string,
    filters: TaskListFilters,
    signal?: AbortSignal,
  ): Promise<TaskPage> {
    if (!workspaceId) throw new ApiError('Select a workspace to load tasks.', 400);
    if (filters.relation === 'all' && filters.canViewAllTasks !== true) {
      throw new ApiError('You do not have permission to view all tasks.', 403);
    }
    if (!Number.isInteger(filters.page) || filters.page < 1) {
      throw new ApiError('The task page is invalid.', 400);
    }

    const token = await this.sessions.getAccessToken();
    const params = new URLSearchParams({
      scope: filters.relation === 'all' ? 'workspace' : 'assigned_workspace',
      relation: filters.relation,
      limit: String(TASK_PAGE_SIZE),
      page: String(filters.page),
    });
    const query = filters.query?.trim().slice(0, 100);
    if (query) params.set('q', query);
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);

    const response: unknown = await this.client.get(`/tasks?${params.toString()}`, {
      token,
      workspaceId,
      signal,
    });
    requireSuccess(response, 'The task list response was invalid.');
    const data = requireDataRecord(response.data, 'The task list response was invalid.');
    if (
      !Array.isArray(data.tasks) ||
      !data.tasks.every((task) => isTaskRecord(task) && task.companyId === workspaceId) ||
      !Number.isInteger(response.total) ||
      Number(response.total) < 0
    ) {
      throw new ApiError('The backend returned an invalid task list.', 502);
    }

    return {
      tasks: data.tasks,
      total: Number(response.total),
      page: filters.page,
    };
  }

  async getTask(taskId: string, workspaceId: string, signal?: AbortSignal): Promise<TaskDetails> {
    if (!taskId || !workspaceId) throw new ApiError('The task is unavailable.', 400);
    const token = await this.sessions.getAccessToken();
    const response: unknown = await this.client.get(`/tasks/${encodeURIComponent(taskId)}`, {
      token,
      workspaceId,
      signal,
    });
    requireSuccess(response, 'The task details response was invalid.');
    const data = requireDataRecord(response.data, 'The task details response was invalid.');
    const task = requireWorkspaceTask(data.task, workspaceId, taskId);
    if (!isTaskAccess(data.access)) {
      throw new ApiError('The backend returned invalid task access information.', 502);
    }
    if (!data.access.canView) throw new ApiError('You do not have access to this task.', 403);
    return { task, access: data.access };
  }

  async getDependencies(
    taskId: string,
    workspaceId: string,
    signal?: AbortSignal,
  ): Promise<TaskDependencyGraph> {
    const token = await this.sessions.getAccessToken();
    const response: unknown = await this.client.get(
      `/tasks/${encodeURIComponent(taskId)}/dependencies`,
      { token, workspaceId, signal },
    );
    requireSuccess(response, 'The task dependency response was invalid.');
    const data = requireDataRecord(response.data, 'The task dependency response was invalid.');
    const isDependency = (item: unknown): item is TaskDependencyItem =>
      isRecord(item) &&
      typeof item.linkId === 'string' &&
      typeof item.status === 'string' &&
      typeof item.resolved === 'boolean' &&
      typeof item.restricted === 'boolean' &&
      (item.task === undefined ||
        item.task === null ||
        (isRecord(item.task) &&
          typeof item.task.id === 'string' &&
          typeof item.task.title === 'string' &&
          typeof item.task.status === 'string'));
    if (
      !Array.isArray(data.dependsOn) ||
      !data.dependsOn.every(isDependency) ||
      !Array.isArray(data.blocking) ||
      !data.blocking.every(isDependency) ||
      typeof data.isBlocked !== 'boolean' ||
      typeof data.unresolvedDependencyCount !== 'number' ||
      typeof data.dependsOnCount !== 'number' ||
      typeof data.blockingCount !== 'number' ||
      typeof data.hasCancelledDependency !== 'boolean'
    ) {
      throw new ApiError('The backend returned invalid task dependencies.', 502);
    }
    return {
      dependsOn: data.dependsOn,
      blocking: data.blocking,
      isBlocked: data.isBlocked,
      unresolvedDependencyCount: data.unresolvedDependencyCount,
      dependsOnCount: data.dependsOnCount,
      blockingCount: data.blockingCount,
      hasCancelledDependency: data.hasCancelledDependency,
    };
  }

  async createTask(
    workspaceId: string,
    input: CreateTaskInput,
    projectContext = false,
  ): Promise<TaskRecord> {
    if (!workspaceId) throw new ApiError('Select a workspace before creating a task.', 400);
    const token = await this.sessions.getAccessToken();
    const assigneeIds = [...new Set(input.assigneeIds ?? [])];
    const payload = {
      title: input.title.trim(),
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      priority: input.priority,
      ...(input.deadline ? { deadline: input.deadline } : {}),
      ...(assigneeIds.length ? { assigneeId: assigneeIds[0], assigneeIds } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.teamId ? { teamId: input.teamId } : {}),
    };
    const path =
      projectContext && input.projectId
        ? `/projects/${encodeURIComponent(input.projectId)}/tasks`
        : '/tasks';
    const response: unknown = await this.client.post(path, payload, { token, workspaceId });
    requireSuccess(response, 'The task creation response was invalid.');
    const data = requireDataRecord(response.data, 'The task creation response was invalid.');
    const taskCandidate = isRecord(data.task) ? data.task : data;
    return requireWorkspaceTask(taskCandidate, workspaceId);
  }

  async updateTask(
    taskId: string,
    workspaceId: string,
    input: UpdateTaskInput,
    access: TaskAccess,
    signal?: AbortSignal,
  ): Promise<TaskRecord> {
    if (!access.canEdit || access.readOnly) {
      throw new ApiError('You do not have permission to edit this task.', 403);
    }
    if (!taskId || !workspaceId) throw new ApiError('The task is unavailable.', 400);
    const token = await this.sessions.getAccessToken();
    const response: unknown = await this.client.request(`/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      body: input,
      token,
      workspaceId,
      signal,
    });
    requireSuccess(response, 'The task update response was invalid.');
    const data = requireDataRecord(response.data, 'The task update response was invalid.');
    const task = requireWorkspaceTask(data.task, workspaceId, taskId);
    if (
      (input.title !== undefined && task.title !== input.title) ||
      (input.description !== undefined && (task.description ?? '') !== input.description) ||
      (input.priority !== undefined && task.priority !== input.priority) ||
      (input.deadline !== undefined && (task.deadline ?? null) !== input.deadline)
    ) {
      throw new ApiError(
        'The backend did not apply all requested task changes. Your task was not refreshed.',
        403,
      );
    }
    return task;
  }

  async getMembers(workspaceId: string, signal?: AbortSignal): Promise<TaskMemberOption[]> {
    const token = await this.sessions.getAccessToken();
    const response: unknown = await this.client.get('/team/members', {
      token,
      workspaceId,
      signal,
    });
    requireSuccess(response, 'The workspace member response was invalid.');
    const data = requireDataRecord(response.data, 'The workspace member response was invalid.');
    if (
      !Array.isArray(data.members) ||
      !data.members.every(
        (member) =>
          isRecord(member) &&
          typeof member.userId === 'string' &&
          member.companyId === workspaceId &&
          typeof member.status === 'string' &&
          isRecord(member.user) &&
          typeof member.user.firstName === 'string' &&
          typeof member.user.lastName === 'string' &&
          (member.user.isActive === undefined || typeof member.user.isActive === 'boolean'),
      )
    ) {
      throw new ApiError('The backend returned invalid workspace members.', 502);
    }
    return data.members
      .filter((member) => member.status === 'active' && member.user.isActive !== false)
      .map((member) => ({
        userId: member.userId as string,
        firstName: member.user.firstName as string,
        lastName: member.user.lastName as string,
      }));
  }

  async getProjects(workspaceId: string, signal?: AbortSignal): Promise<TaskProjectOption[]> {
    const token = await this.sessions.getAccessToken();
    const response: unknown = await this.client.get('/projects', { token, workspaceId, signal });
    requireSuccess(response, 'The project response was invalid.');
    const data = requireDataRecord(response.data, 'The project response was invalid.');
    if (!Array.isArray(data.projects) || !data.projects.every(displayName)) {
      throw new ApiError('The backend returned invalid projects.', 502);
    }
    if (data.projects.some((project) => project.companyId !== workspaceId)) {
      throw new ApiError('The backend returned projects from another workspace.', 502);
    }
    return data.projects.map(({ id, name }) => ({ id, name }));
  }

  async getTeams(workspaceId: string, signal?: AbortSignal): Promise<TaskTeamOption[]> {
    const token = await this.sessions.getAccessToken();
    const response: unknown = await this.client.get('/team/teams', { token, workspaceId, signal });
    requireSuccess(response, 'The team response was invalid.');
    const data = requireDataRecord(response.data, 'The team response was invalid.');
    if (
      !Array.isArray(data.teams) ||
      !data.teams.every(isTaskTeam) ||
      data.teams.some(
        (team) =>
          team.companyId !== workspaceId ||
          (team.memberLinks !== undefined &&
            (!Array.isArray(team.memberLinks) ||
              !team.memberLinks.every(
                (link) =>
                  isRecord(link) &&
                  (link.companyMember === undefined ||
                    link.companyMember === null ||
                    (isRecord(link.companyMember) && isOptionalString(link.companyMember.userId))),
              ))) ||
          (team.leadMember !== undefined &&
            team.leadMember !== null &&
            (!isRecord(team.leadMember) || !isOptionalString(team.leadMember.userId))),
      )
    ) {
      throw new ApiError('The backend returned invalid teams.', 502);
    }
    return data.teams.map((team) => {
      const memberIds = new Set<string>();
      if (isRecord(team.leadMember) && typeof team.leadMember.userId === 'string') {
        memberIds.add(team.leadMember.userId);
      }
      if (Array.isArray(team.memberLinks)) {
        for (const link of team.memberLinks) {
          if (
            isRecord(link) &&
            isRecord(link.companyMember) &&
            typeof link.companyMember.userId === 'string'
          ) {
            memberIds.add(link.companyMember.userId);
          }
        }
      }
      return {
        id: team.id as string,
        name: team.name as string,
        memberIds: [...memberIds],
      };
    });
  }

  async getTeamLead(
    teamId: string,
    workspaceId: string,
    signal?: AbortSignal,
  ): Promise<string | null> {
    const token = await this.sessions.getAccessToken();
    const response: unknown = await this.client.get(`/team/teams/${encodeURIComponent(teamId)}`, {
      token,
      workspaceId,
      signal,
    });
    requireSuccess(response, 'The team response was invalid.');
    const data = requireDataRecord(response.data, 'The team response was invalid.');
    const team = requireDataRecord(data.team, 'The team response was invalid.');
    if (
      team.companyId !== workspaceId ||
      (team.leadMember !== undefined &&
        team.leadMember !== null &&
        (!isRecord(team.leadMember) || !isOptionalString(team.leadMember.userId)))
    ) {
      throw new ApiError('The backend returned a team from another workspace.', 502);
    }
    return isRecord(team.leadMember) && typeof team.leadMember.userId === 'string'
      ? team.leadMember.userId
      : null;
  }
}

export const taskService = new TaskService();
