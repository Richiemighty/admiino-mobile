export interface ApiErrorPayload {
  status?: string;
  code?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  accountType?: 'workspace';
}

export interface MobileUser {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  accountType?: string;
  role?: string;
  isVerified?: boolean;
  isActive?: boolean;
  [key: string]: unknown;
}

export interface MobileWorkspace {
  companyId: string;
  role: string;
  status: string;
  isVerified: boolean;
  company: {
    id: string;
    name: string;
    companyCode: string;
    logoUrl?: string | null;
  };
}

export interface LoginResponse {
  status: 'success';
  message: string;
  token: string;
  data: {
    user: MobileUser;
    workspaces?: MobileWorkspace[];
  };
}

export interface MeResponse {
  status: 'success';
  data: { user: MobileUser };
}

export interface WorkspacesResponse {
  status: 'success';
  data: { workspaces: MobileWorkspace[] };
}

export interface EffectiveWorkspacePermissions {
  companyId: string;
  userId: string;
  role: string;
  rolePermissions: Record<string, boolean>;
  individualOverrides: Record<string, boolean>;
  permissions: Record<string, boolean>;
}

export interface EffectiveWorkspacePermissionsResponse {
  status: 'success';
  data: EffectiveWorkspacePermissions;
}

export interface WorkspaceJoinRequest {
  id: string;
  companyId: string;
  status: 'pending' | 'approved' | 'denied' | 'withdrawn';
  createdAt: string;
  decidedAt: string | null;
  workspace: { id: string; name: string } | null;
}

export interface WorkspaceJoinRequestsResponse {
  status: 'success';
  data: { requests: WorkspaceJoinRequest[] };
}

export interface WorkspaceCodeResolutionResponse {
  status: 'success';
  data: { workspace: { name: string; companyCode: string } };
}

export interface CreateWorkspaceResponse {
  status: 'success';
  message: string;
  data: { company: { id: string; name: string; companyCode: string } };
}

export interface PersonalTaskSummary {
  relation: 'all' | 'assigned' | 'created';
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  inReviewTasks: number;
  delayedTasks: number;
  completedTasks: number;
  cancelledTasks: number;
  openTasks: number;
  overdueTasks: number;
  urgentTasks: number;
  completionRate: number;
}

export interface PersonalTaskSummaryResponse {
  status: 'success';
  data: { summary: PersonalTaskSummary };
}

export interface PersonalTaskItem {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  deadline?: string | null;
}

export interface PersonalTaskListResponse {
  status: 'success';
  results: number;
  total: number;
  data: { tasks: PersonalTaskItem[] };
}

export interface GlobalSearchResult {
  id: string;
  title: string;
  subtitle: string;
}

export interface GlobalSearchResponse {
  status: 'success';
  data: {
    groups: {
      tasks?: GlobalSearchResult[];
      projects?: GlobalSearchResult[];
      people?: GlobalSearchResult[];
      [key: string]: GlobalSearchResult[] | undefined;
    };
  };
}
