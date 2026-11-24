import { apiClient, ApiError } from '../../api';
import type { ApiClient } from '../../api/client';
import type { SessionService } from '../../auth/session';
import { sessionService } from '../../auth/session';

export interface ApprovalRequester {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface JoinRequest {
  id: string;
  companyId: string;
  status: string;
  createdAt: string;
  message: string | null;
  requester: (ApprovalRequester & { emailVerified?: boolean; isActive?: boolean }) | null;
  workspace: { id: string; name: string } | null;
  decidedAt: string | null;
}

export interface PendingVerification {
  id: string;
  companyId: string;
  userId: string;
  status: string;
  isVerified: boolean;
  createdAt: string;
  user: ApprovalRequester | null;
}

export interface AccessRequest {
  id: string;
  companyId: string;
  requesterUserId: string;
  permissionKey: string;
  reason: string | null;
  status: string;
  createdAt: string;
  requester: ApprovalRequester | null;
}

export interface JoinRequestPage {
  requests: JoinRequest[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ApiEnvelope {
  status: string;
  data: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function parseRequester(value: unknown): ApprovalRequester | null {
  if (value === null || value === undefined) return null;
  if (
    !isRecord(value) ||
    (value.id !== undefined && value.id !== null && typeof value.id !== 'string') ||
    !optionalString(value.firstName) ||
    !optionalString(value.lastName) ||
    !optionalString(value.email)
  ) {
    throw new ApiError('The backend returned an invalid approval requester.', 502);
  }
  return {
    id: typeof value.id === 'string' ? value.id : '',
    firstName: value.firstName ?? null,
    lastName: value.lastName ?? null,
    email: value.email ?? null,
  };
}

function parseJoinRequest(value: unknown, workspaceId: string): JoinRequest {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.companyId !== workspaceId ||
    typeof value.status !== 'string' ||
    typeof value.createdAt !== 'string' ||
    !optionalString(value.message) ||
    !optionalString(value.decidedAt)
  ) {
    throw new ApiError('The backend returned a join request outside the active workspace.', 502);
  }
  const requester = parseRequester(value.requester);
  const workspace =
    value.workspace === null || value.workspace === undefined
      ? null
      : isRecord(value.workspace) &&
          typeof value.workspace.id === 'string' &&
          typeof value.workspace.name === 'string'
        ? { id: value.workspace.id, name: value.workspace.name }
        : null;
  if (value.workspace !== null && value.workspace !== undefined && !workspace) {
    throw new ApiError('The backend returned invalid join-request workspace information.', 502);
  }
  const requesterDetails = value.requester;
  return {
    id: value.id,
    companyId: value.companyId,
    status: value.status,
    createdAt: value.createdAt,
    message: value.message ?? null,
    requester:
      requester && isRecord(requesterDetails)
        ? {
            ...requester,
            ...(typeof requesterDetails.emailVerified === 'boolean'
              ? { emailVerified: requesterDetails.emailVerified }
              : {}),
            ...(typeof requesterDetails.isActive === 'boolean'
              ? { isActive: requesterDetails.isActive }
              : {}),
          }
        : requester,
    workspace,
    decidedAt: value.decidedAt ?? null,
  };
}

function parsePendingVerification(value: unknown, workspaceId: string): PendingVerification {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.companyId !== workspaceId ||
    typeof value.userId !== 'string' ||
    typeof value.status !== 'string' ||
    typeof value.isVerified !== 'boolean' ||
    typeof value.createdAt !== 'string'
  ) {
    throw new ApiError(
      'The backend returned a verification request outside the active workspace.',
      502,
    );
  }
  return {
    id: value.id,
    companyId: value.companyId,
    userId: value.userId,
    status: value.status,
    isVerified: value.isVerified,
    createdAt: value.createdAt,
    user: parseRequester(value.user),
  };
}

function parseAccessRequest(value: unknown, workspaceId: string): AccessRequest {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.companyId !== workspaceId ||
    typeof value.requesterUserId !== 'string' ||
    typeof value.permissionKey !== 'string' ||
    typeof value.status !== 'string' ||
    typeof value.createdAt !== 'string' ||
    !optionalString(value.reason)
  ) {
    throw new ApiError(
      'The backend returned a permission request outside the active workspace.',
      502,
    );
  }
  return {
    id: value.id,
    companyId: value.companyId,
    requesterUserId: value.requesterUserId,
    permissionKey: value.permissionKey,
    reason: value.reason ?? null,
    status: value.status,
    createdAt: value.createdAt,
    requester: parseRequester(value.requester),
  };
}

function requireEnvelope(value: unknown, message: string): ApiEnvelope {
  if (!isRecord(value) || value.status !== 'success' || !isRecord(value.data)) {
    throw new ApiError(message, 502);
  }
  return { status: value.status, data: value.data };
}

export class WorkspaceApprovalsService {
  constructor(
    private readonly client: ApiClient = apiClient,
    private readonly sessions: Pick<SessionService, 'getAccessToken'> = sessionService,
  ) {}

  async listJoinRequests(
    workspaceId: string,
    options: { page?: number; pageSize?: number; signal?: AbortSignal } = {},
  ): Promise<JoinRequestPage> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const token = await this.sessions.getAccessToken();
    const response = requireEnvelope(
      await this.client.get<unknown>(
        `/companies/join/requests?status=pending&page=${page}&pageSize=${pageSize}`,
        { token, workspaceId, signal: options.signal },
      ),
      'The backend returned an invalid join-request response.',
    );
    const requests = response.data.requests;
    const pagination = response.data.pagination;
    if (
      !Array.isArray(requests) ||
      !isRecord(pagination) ||
      typeof pagination.page !== 'number' ||
      !Number.isInteger(pagination.page) ||
      typeof pagination.pageSize !== 'number' ||
      !Number.isInteger(pagination.pageSize) ||
      typeof pagination.total !== 'number' ||
      !Number.isInteger(pagination.total) ||
      typeof pagination.totalPages !== 'number' ||
      !Number.isInteger(pagination.totalPages)
    ) {
      throw new ApiError('The backend returned invalid join-request pagination.', 502);
    }
    return {
      requests: requests.map((request) => parseJoinRequest(request, workspaceId)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
    };
  }

  async getJoinRequest(
    workspaceId: string,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<JoinRequest> {
    const token = await this.sessions.getAccessToken();
    const response = requireEnvelope(
      await this.client.get<unknown>(`/companies/join/requests/${encodeURIComponent(requestId)}`, {
        token,
        workspaceId,
        signal,
      }),
      'The backend returned an invalid join-request response.',
    );
    return parseJoinRequest(response.data.request, workspaceId);
  }

  async decideJoinRequest(
    workspaceId: string,
    requestId: string,
    action: 'approve' | 'decline',
    signal?: AbortSignal,
  ): Promise<JoinRequest> {
    const token = await this.sessions.getAccessToken();
    const response = requireEnvelope(
      await this.client.request<unknown>(
        `/companies/join/requests/${encodeURIComponent(requestId)}`,
        { method: 'PATCH', body: { action }, token, workspaceId, signal },
      ),
      'The backend did not confirm the join-request decision.',
    );
    return parseJoinRequest(response.data.request, workspaceId);
  }

  async listPendingVerifications(
    workspaceId: string,
    signal?: AbortSignal,
  ): Promise<PendingVerification[]> {
    const token = await this.sessions.getAccessToken();
    const response = requireEnvelope(
      await this.client.get<unknown>('/team/pending-verifications', {
        token,
        workspaceId,
        signal,
      }),
      'The backend returned an invalid member-verification response.',
    );
    if (!Array.isArray(response.data.pendingMembers)) {
      throw new ApiError('The backend returned an invalid member-verification queue.', 502);
    }
    return response.data.pendingMembers
      .map((member) => parsePendingVerification(member, workspaceId))
      .filter((member) => !member.isVerified && member.status !== 'removed');
  }

  async decideMemberVerification(
    workspaceId: string,
    userId: string,
    action: 'approve' | 'reject',
    signal?: AbortSignal,
  ): Promise<void> {
    const token = await this.sessions.getAccessToken();
    const response =
      action === 'approve'
        ? await this.client.request<{ status: string }>(
            `/team/verify/${encodeURIComponent(userId)}`,
            {
              method: 'PATCH',
              token,
              workspaceId,
              signal,
            },
          )
        : await this.client.request<{ status: string }>(
            `/team/reject/${encodeURIComponent(userId)}`,
            { method: 'DELETE', token, workspaceId, signal },
          );
    if (response.status !== 'success') {
      throw new ApiError('The backend did not confirm the member-verification decision.', 502);
    }
  }

  async listAccessRequests(workspaceId: string, signal?: AbortSignal): Promise<AccessRequest[]> {
    const token = await this.sessions.getAccessToken();
    const response = requireEnvelope(
      await this.client.get<unknown>('/access-requests?status=pending&limit=200', {
        token,
        workspaceId,
        signal,
      }),
      'The backend returned an invalid permission-request response.',
    );
    if (!Array.isArray(response.data.requests)) {
      throw new ApiError('The backend returned an invalid permission-request queue.', 502);
    }
    return response.data.requests
      .map((request) => parseAccessRequest(request, workspaceId))
      .filter((request) => request.status === 'pending');
  }

  async decideAccessRequest(
    workspaceId: string,
    requestId: string,
    action: 'approve' | 'deny',
    signal?: AbortSignal,
  ): Promise<void> {
    const token = await this.sessions.getAccessToken();
    const response = requireEnvelope(
      await this.client.request<unknown>(`/access-requests/${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: { action },
        token,
        workspaceId,
        signal,
      }),
      'The backend did not confirm the permission-request decision.',
    );
    if (!isRecord(response.data.request) || response.data.request.id !== requestId) {
      throw new ApiError('The backend returned an invalid permission-request decision.', 502);
    }
  }
}

export const workspaceApprovalsService = new WorkspaceApprovalsService();
