import { apiClient, ApiError } from '../../api';
import type { ApiClient } from '../../api/client';
import type { SessionService } from '../../auth/session';
import { sessionService } from '../../auth/session';
import type { TaskTeamOption } from '../tasks/service';

export const PROJECT_STATUSES = [
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
  'archived',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectTeam {
  id: string;
  name: string;
  leadMemberId?: string | null;
}

export interface EmbeddedProjectMember {
  id: string;
  role?: string;
  status?: string;
  ProjectMember?: { role?: string; status?: string };
  projectMember?: { role?: string; status?: string };
}

export interface ProjectRecord {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  visibility: 'private' | 'workspace';
  teamId?: string | null;
  team?: ProjectTeam | null;
  startDate?: string | null;
  endDate?: string | null;
  dueDate?: string | null;
  leadId?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  color?: string | null;
  members?: EmbeddedProjectMember[];
}

export interface ProjectMember {
  id: string;
  role: string;
  status: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

export interface ProjectTask {
  id: string;
  companyId: string;
  projectId?: string | null;
  title: string;
  status: string | null;
  priority: string | null;
  deadline?: string | null;
  assignee?: { id: string; firstName?: string | null; lastName?: string | null } | null;
}

export interface ProjectFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize?: number | null;
  createdAt?: string;
}

export interface ProjectFolder {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface ProjectFileListing {
  rootFolder: { id: string; name: string };
  folder: ProjectFolder;
  breadcrumbs: ProjectFolder[];
  folders: ProjectFolder[];
  files: ProjectFile[];
}

export interface ProjectFormInput {
  name: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  teamId?: string;
}

export interface ProjectUpdateInput extends ProjectFormInput {
  status: ProjectStatus;
}

export interface ProjectGovernanceCapabilities {
  projectCreationRestricted: boolean;
}

const PROJECT_SEARCH_LIMIT = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && PROJECT_STATUSES.some((status) => status === value);
}

function requireSuccess(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!isRecord(value) || value.status !== 'success') throw new ApiError(message, 502);
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) throw new ApiError(message, 502);
  return value;
}

function projectTeam(value: unknown): value is ProjectTeam {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isOptionalString(value.leadMemberId)
  );
}

function embeddedMember(value: unknown): value is EmbeddedProjectMember {
  if (!isRecord(value) || typeof value.id !== 'string') return false;
  const projectMember = value.ProjectMember ?? value.projectMember;
  return (
    projectMember === undefined ||
    projectMember === null ||
    (isRecord(projectMember) &&
      isOptionalString(projectMember.role) &&
      isOptionalString(projectMember.status) &&
      typeof projectMember.role !== 'undefined')
  );
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.companyId !== 'string' ||
    typeof value.name !== 'string' ||
    !isProjectStatus(value.status) ||
    (value.visibility !== 'private' && value.visibility !== 'workspace') ||
    !isOptionalString(value.description) ||
    !isOptionalString(value.teamId) ||
    !isOptionalString(value.startDate) ||
    !isOptionalString(value.endDate) ||
    !isOptionalString(value.dueDate) ||
    !isOptionalString(value.leadId) ||
    !isOptionalString(value.createdBy) ||
    !isOptionalString(value.createdAt) ||
    !isOptionalString(value.updatedAt) ||
    !isOptionalString(value.color)
  ) {
    return false;
  }
  if (value.team !== undefined && value.team !== null && !projectTeam(value.team)) return false;
  if (
    value.members !== undefined &&
    (!Array.isArray(value.members) || !value.members.every(embeddedMember))
  ) {
    return false;
  }
  return true;
}

function requireWorkspaceProject(
  value: unknown,
  workspaceId: string,
  projectId?: string,
): ProjectRecord {
  if (!isProjectRecord(value)) throw new ApiError('The backend returned an invalid project.', 502);
  if (value.companyId !== workspaceId || (projectId !== undefined && value.id !== projectId)) {
    throw new ApiError('This project is not part of the active workspace.', 404, {
      code: 'PROJECT_NOT_IN_ACTIVE_WORKSPACE',
    });
  }
  if (value.team?.id && value.teamId && value.team.id !== value.teamId) {
    throw new ApiError('The backend returned an inconsistent project team.', 502);
  }
  return value;
}

function isProjectTask(value: unknown): value is ProjectTask {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.companyId === 'string' &&
    typeof value.title === 'string' &&
    (value.status === null || typeof value.status === 'string') &&
    (value.priority === null || typeof value.priority === 'string') &&
    isOptionalString(value.projectId) &&
    isOptionalString(value.deadline) &&
    (value.assignee === undefined ||
      value.assignee === null ||
      (isRecord(value.assignee) &&
        typeof value.assignee.id === 'string' &&
        isOptionalString(value.assignee.firstName) &&
        isOptionalString(value.assignee.lastName)))
  );
}

function isProjectMember(value: unknown): value is ProjectMember {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.role === 'string' &&
    typeof value.status === 'string' &&
    isOptionalString(value.firstName) &&
    isOptionalString(value.lastName) &&
    isOptionalString(value.email)
  );
}

function isProjectFile(value: unknown): value is ProjectFile {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.fileName === 'string' &&
    typeof value.fileType === 'string' &&
    (value.fileSize === undefined ||
      value.fileSize === null ||
      typeof value.fileSize === 'number') &&
    isOptionalString(value.createdAt)
  );
}

function isProjectFolder(value: unknown): value is ProjectFolder {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isOptionalString(value.parentId)
  );
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateToIso(value: string | undefined): string | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

function validateFormInput(input: ProjectFormInput) {
  if (!input.name.trim()) throw new ApiError('Enter a project name.', 400);
  if (input.startDate && !validDate(input.startDate))
    throw new ApiError('Enter a valid start date in YYYY-MM-DD format.', 400);
  if (input.dueDate && !validDate(input.dueDate))
    throw new ApiError('Enter a valid due date in YYYY-MM-DD format.', 400);
  if (input.startDate && input.dueDate && input.dueDate < input.startDate) {
    throw new ApiError('Due date cannot be before the start date.', 400);
  }
}

function projectFromResponse(
  response: unknown,
  workspaceId: string,
  projectId?: string,
): ProjectRecord {
  requireSuccess(response, 'The project response was invalid.');
  const data = requireRecord(response.data, 'The project response was invalid.');
  return requireWorkspaceProject(data.project, workspaceId, projectId);
}

export class ProjectService {
  constructor(
    private readonly client: ApiClient = apiClient,
    private readonly sessions: SessionService = sessionService,
  ) {}

  async listProjects(
    workspaceId: string,
    options: { search?: string; signal?: AbortSignal } = {},
  ): Promise<ProjectRecord[]> {
    if (!workspaceId) throw new ApiError('Select a workspace to load projects.', 400);
    const token = await this.sessions.getAccessToken();
    const params = new URLSearchParams();
    const search = options.search?.trim().slice(0, PROJECT_SEARCH_LIMIT);
    if (search) params.set('search', search);
    const query = params.size ? `?${params.toString()}` : '';
    const response: unknown = await this.client.get(`/projects${query}`, {
      token,
      workspaceId,
      signal: options.signal,
    });
    requireSuccess(response, 'The project list response was invalid.');
    const data = requireRecord(response.data, 'The project list response was invalid.');
    if (!Array.isArray(data.projects)) {
      throw new ApiError('The backend returned an invalid project list.', 502);
    }
    return data.projects.map((project) => requireWorkspaceProject(project, workspaceId));
  }

  async getProject(
    projectId: string,
    workspaceId: string,
    signal?: AbortSignal,
  ): Promise<ProjectRecord> {
    if (!projectId || !workspaceId) throw new ApiError('The project is unavailable.', 400);
    const token = await this.sessions.getAccessToken();
    const response: unknown = await this.client.get(`/projects/${encodeURIComponent(projectId)}`, {
      token,
      workspaceId,
      signal,
    });
    return projectFromResponse(response, workspaceId, projectId);
  }

  async listProjectTasks(
    projectId: string,
    workspaceId: string,
    signal?: AbortSignal,
  ): Promise<ProjectTask[]> {
    const token = await this.sessions.getAccessToken();
    const response: unknown = await this.client.get(
      `/projects/${encodeURIComponent(projectId)}/tasks`,
      { token, workspaceId, signal },
    );
    requireSuccess(response, 'The project task response was invalid.');
    const data = response.data;
    const tasks = Array.isArray(data)
      ? data
      : isRecord(data) && Array.isArray(data.tasks)
        ? data.tasks
        : null;
    if (!tasks || !tasks.every(isProjectTask)) {
      throw new ApiError('The backend returned invalid project tasks.', 502);
    }
    if (tasks.some((task) => task.companyId !== workspaceId || task.projectId !== projectId)) {
      throw new ApiError('The backend returned tasks outside this project.', 502);
    }
    return tasks;
  }

  async getProjectMembers(
    projectId: string,
    workspaceId: string,
    signal?: AbortSignal,
  ): Promise<ProjectMember[]> {
    const token = await this.sessions.getAccessToken();
    const response: unknown = await this.client.get(
      `/projects/${encodeURIComponent(projectId)}/members`,
      { token, workspaceId, signal },
    );
    requireSuccess(response, 'The project member response was invalid.');
    const data = requireRecord(response.data, 'The project member response was invalid.');
    if (!Array.isArray(data.members) || !data.members.every(isProjectMember)) {
      throw new ApiError('The backend returned invalid project members.', 502);
    }
    return data.members;
  }

  async getProjectFiles(
    projectId: string,
    workspaceId: string,
    folderId?: string,
    signal?: AbortSignal,
  ): Promise<ProjectFileListing> {
    const token = await this.sessions.getAccessToken();
    const params = new URLSearchParams();
    if (folderId) params.set('folderId', folderId);
    const query = params.size ? `?${params.toString()}` : '';
    const response: unknown = await this.client.get(
      `/projects/${encodeURIComponent(projectId)}/files${query}`,
      { token, workspaceId, signal },
    );
    requireSuccess(response, 'The project file response was invalid.');
    const data = requireRecord(response.data, 'The project file response was invalid.');
    if (
      !isProjectFolder(data.rootFolder) ||
      !isProjectFolder(data.folder) ||
      !Array.isArray(data.breadcrumbs) ||
      !data.breadcrumbs.every(isProjectFolder) ||
      !Array.isArray(data.folders) ||
      !data.folders.every(isProjectFolder) ||
      !Array.isArray(data.files) ||
      !data.files.every(isProjectFile)
    ) {
      throw new ApiError('The backend returned invalid project files.', 502);
    }
    return {
      rootFolder: data.rootFolder,
      folder: data.folder,
      breadcrumbs: data.breadcrumbs,
      folders: data.folders,
      files: data.files,
    };
  }

  async getGovernanceCapabilities(
    workspaceId: string,
    signal?: AbortSignal,
  ): Promise<ProjectGovernanceCapabilities> {
    const token = await this.sessions.getAccessToken();
    const response: unknown = await this.client.get('/workspace/governance/capabilities', {
      token,
      workspaceId,
      signal,
    });
    requireSuccess(response, 'The workspace governance response was invalid.');
    const data = requireRecord(response.data, 'The workspace governance response was invalid.');
    if (typeof data.projectCreationRestricted !== 'boolean') {
      throw new ApiError('The backend returned invalid project governance.', 502);
    }
    return { projectCreationRestricted: data.projectCreationRestricted };
  }

  async listTeams(workspaceId: string, signal?: AbortSignal): Promise<TaskTeamOption[]> {
    const token = await this.sessions.getAccessToken();
    const response: unknown = await this.client.get('/team/teams', {
      token,
      workspaceId,
      signal,
    });
    requireSuccess(response, 'The project team response was invalid.');
    const data = requireRecord(response.data, 'The project team response was invalid.');
    if (
      !Array.isArray(data.teams) ||
      !data.teams.every(
        (team) =>
          isRecord(team) &&
          typeof team.id === 'string' &&
          typeof team.name === 'string' &&
          team.companyId === workspaceId,
      )
    ) {
      throw new ApiError('The backend returned invalid project teams.', 502);
    }
    return data.teams.map((team) => ({
      id: team.id as string,
      name: team.name as string,
      memberIds: [],
    }));
  }

  async createProject(workspaceId: string, input: ProjectFormInput): Promise<ProjectRecord> {
    if (!workspaceId) throw new ApiError('Select a workspace before creating a project.', 400);
    validateFormInput(input);
    const token = await this.sessions.getAccessToken();
    const payload = {
      name: input.name.trim(),
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      ...(input.startDate ? { startDate: dateToIso(input.startDate) } : {}),
      ...(input.dueDate ? { dueDate: dateToIso(input.dueDate) } : {}),
      ...(input.teamId ? { teamId: input.teamId } : {}),
    };
    const response: unknown = await this.client.post('/projects', payload, { token, workspaceId });
    const project = projectFromResponse(response, workspaceId);
    if (project.name !== payload.name) {
      throw new ApiError('The backend did not save the requested project name.', 502);
    }
    return project;
  }

  async updateProject(
    projectId: string,
    workspaceId: string,
    input: ProjectUpdateInput,
  ): Promise<ProjectRecord> {
    if (!projectId || !workspaceId) throw new ApiError('The project is unavailable.', 400);
    validateFormInput(input);
    const token = await this.sessions.getAccessToken();
    const payload = {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: input.status,
      startDate: dateToIso(input.startDate) ?? null,
      dueDate: dateToIso(input.dueDate) ?? null,
      ...(input.teamId !== undefined ? { teamId: input.teamId || null } : {}),
    };
    const response: unknown = await this.client.request(
      `/projects/${encodeURIComponent(projectId)}`,
      { method: 'PATCH', body: payload, token, workspaceId },
    );
    const project = projectFromResponse(response, workspaceId, projectId);
    if (
      project.name !== payload.name ||
      (project.description ?? null) !== payload.description ||
      project.status !== payload.status ||
      dateOnly(project.startDate) !== dateOnly(payload.startDate) ||
      dateOnly(project.dueDate) !== dateOnly(payload.dueDate) ||
      (input.teamId !== undefined && (project.teamId ?? null) !== (payload.teamId ?? null))
    ) {
      throw new ApiError('The backend did not apply all requested project changes.', 502);
    }
    return project;
  }
}

export const projectService = new ProjectService();
