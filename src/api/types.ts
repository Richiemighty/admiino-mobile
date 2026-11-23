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
