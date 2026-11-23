import { apiClient, ApiError } from '../../api';
import type { ApiClient } from '../../api/client';
import type {
  GlobalSearchResponse,
  GlobalSearchResult,
  PersonalTaskItem,
  PersonalTaskListResponse,
  PersonalTaskSummary,
  PersonalTaskSummaryResponse,
} from '../../api/types';
import type { SessionService } from '../../auth/session';
import { sessionService } from '../../auth/session';

export interface HomeDashboardData {
  workspaceId: string;
  summary: PersonalTaskSummary;
  tasks: PersonalTaskItem[];
}

export type GlobalSearchGroups = {
  tasks: GlobalSearchResult[];
  projects: GlobalSearchResult[];
  people: GlobalSearchResult[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPersonalTaskSummary(value: unknown): value is PersonalTaskSummary {
  if (!isRecord(value) || value.relation !== 'assigned') return false;
  return [
    'totalTasks',
    'pendingTasks',
    'inProgressTasks',
    'inReviewTasks',
    'delayedTasks',
    'completedTasks',
    'cancelledTasks',
    'openTasks',
    'overdueTasks',
    'urgentTasks',
    'completionRate',
  ].every((key) => isFiniteNumber(value[key]));
}

function isPersonalTaskItem(value: unknown): value is PersonalTaskItem {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    (typeof value.status === 'string' || value.status === null) &&
    (typeof value.priority === 'string' || value.priority === null) &&
    (value.deadline === undefined || typeof value.deadline === 'string' || value.deadline === null)
  );
}

function isGlobalSearchResult(value: unknown): value is GlobalSearchResult {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.subtitle === 'string'
  );
}

function requireSuccessfulResponse<T extends { status: string }>(response: T, message: string): T {
  if (response.status !== 'success') throw new ApiError(message, 502);
  return response;
}

export class HomeService {
  constructor(
    private readonly client: ApiClient = apiClient,
    private readonly sessions: SessionService = sessionService,
  ) {}

  async getDashboardData(workspaceId: string, signal?: AbortSignal): Promise<HomeDashboardData> {
    if (!workspaceId) throw new ApiError('Select a workspace to load your tasks.', 400);
    const token = await this.sessions.getAccessToken();
    const [summaryResponse, taskResponse] = await Promise.all([
      this.client.get<PersonalTaskSummaryResponse>('/tasks/my/summary?relation=assigned', {
        token,
        workspaceId,
        signal,
      }),
      this.client.get<PersonalTaskListResponse>(
        '/tasks?scope=assigned_workspace&relation=assigned&limit=50&page=1',
        { token, workspaceId, signal },
      ),
    ]);

    requireSuccessfulResponse(summaryResponse, 'The task summary response was invalid.');
    requireSuccessfulResponse(taskResponse, 'The task list response was invalid.');
    if (
      !isPersonalTaskSummary(summaryResponse.data?.summary) ||
      !Array.isArray(taskResponse.data?.tasks) ||
      !taskResponse.data.tasks.every(isPersonalTaskItem) ||
      !isFiniteNumber(taskResponse.total)
    ) {
      throw new ApiError('The backend returned an invalid task dashboard response.', 502);
    }

    return {
      workspaceId,
      summary: summaryResponse.data.summary,
      tasks: taskResponse.data.tasks,
    };
  }
}

export class GlobalSearchService {
  constructor(
    private readonly client: ApiClient = apiClient,
    private readonly sessions: SessionService = sessionService,
  ) {}

  async search(
    query: string,
    workspaceId: string,
    signal?: AbortSignal,
  ): Promise<GlobalSearchGroups> {
    const normalizedQuery = query.trim().slice(0, 100);
    if (normalizedQuery.length < 2)
      throw new ApiError('Search needs at least two characters.', 400);
    if (!workspaceId) throw new ApiError('Select a workspace to search.', 400);

    const token = await this.sessions.getAccessToken();
    const params = new URLSearchParams({ q: normalizedQuery });
    const response = await this.client.get<GlobalSearchResponse>(
      `/global-search?${params.toString()}`,
      { token, workspaceId, signal },
    );
    requireSuccessfulResponse(response, 'The search response was invalid.');

    const groups = response.data?.groups;
    if (!isRecord(groups)) throw new ApiError('The backend returned invalid search results.', 502);

    const resultFor = (key: 'tasks' | 'projects' | 'people') => {
      const results = groups[key];
      if (results === undefined) return [];
      if (!Array.isArray(results) || !results.every(isGlobalSearchResult)) {
        throw new ApiError('The backend returned invalid search results.', 502);
      }
      return results;
    };

    return {
      tasks: resultFor('tasks'),
      projects: resultFor('projects'),
      people: resultFor('people'),
    };
  }
}

export const homeService = new HomeService();
export const globalSearchService = new GlobalSearchService();
