import { apiClient, ApiError } from '../../api';
import type { ApiClient } from '../../api/client';
import type { SessionService } from '../../auth/session';
import { sessionService } from '../../auth/session';
import { type LocalTaskFile, MAX_COMMENT_FILES, validateTaskFile } from './fileContracts';
import type { TaskPerson } from './service';

export interface ConversationAttachment {
  id: string;
  fileName?: string | null;
  fileType?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  uploadedBy?: string | null;
  createdAt?: string | null;
  source?: string | null;
  name?: string | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  isSystemMessage: boolean;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt?: string | null;
  user?: TaskPerson | null;
  metadata: {
    clientMessageId?: string;
    mentionedUserIds?: string[];
  };
  attachments: ConversationAttachment[];
}

export interface ConversationPage {
  comments: TaskComment[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AddCommentInput {
  content: string;
  clientMessageId: string;
  parentCommentId?: string | null;
  mentionedUserIds?: string[];
  files?: LocalTaskFile[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function parsePerson(value: unknown): TaskPerson | null {
  if (value === undefined || value === null) return null;
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !optionalString(value.firstName) ||
    !optionalString(value.lastName) ||
    !optionalString(value.email)
  ) {
    throw new ApiError('The backend returned an invalid comment author.', 502);
  }
  return {
    id: value.id,
    firstName: value.firstName,
    lastName: value.lastName,
    email: value.email,
  };
}

function parseAttachment(value: unknown): ConversationAttachment {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !optionalString(value.fileName) ||
    !optionalString(value.fileType) ||
    !optionalString(value.mimeType) ||
    !(
      value.fileSize === undefined ||
      value.fileSize === null ||
      typeof value.fileSize === 'number'
    ) ||
    !optionalString(value.uploadedBy) ||
    !optionalString(value.createdAt) ||
    !optionalString(value.source) ||
    !optionalString(value.name)
  ) {
    throw new ApiError('The backend returned invalid comment attachment information.', 502);
  }

  return {
    id: value.id,
    fileName: value.fileName,
    fileType: value.fileType,
    mimeType: value.mimeType,
    fileSize: value.fileSize,
    uploadedBy: value.uploadedBy,
    createdAt: value.createdAt,
    source: value.source,
    name: value.name,
  };
}

function parseComment(value: unknown, taskId: string): TaskComment {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.taskId !== taskId ||
    typeof value.userId !== 'string' ||
    typeof value.content !== 'string' ||
    typeof value.isSystemMessage !== 'boolean' ||
    !optionalString(value.parentCommentId) ||
    typeof value.createdAt !== 'string' ||
    !optionalString(value.updatedAt)
  ) {
    throw new ApiError('The backend returned an invalid task comment.', 502);
  }

  let clientMessageId: string | undefined;
  let mentionedUserIds: string[] | undefined;
  if (value.metadata !== undefined && value.metadata !== null) {
    if (!isRecord(value.metadata)) {
      throw new ApiError('The backend returned invalid comment metadata.', 502);
    }
    if (value.metadata.clientMessageId !== undefined) {
      if (typeof value.metadata.clientMessageId !== 'string') {
        throw new ApiError('The backend returned invalid comment metadata.', 502);
      }
      clientMessageId = value.metadata.clientMessageId;
    }
    if (value.metadata.mentionedUserIds !== undefined) {
      if (
        !Array.isArray(value.metadata.mentionedUserIds) ||
        !value.metadata.mentionedUserIds.every((id) => typeof id === 'string')
      ) {
        throw new ApiError('The backend returned invalid comment metadata.', 502);
      }
      mentionedUserIds = value.metadata.mentionedUserIds;
    }
  }

  if (
    value.attachments !== undefined &&
    value.attachments !== null &&
    !Array.isArray(value.attachments)
  ) {
    throw new ApiError('The backend returned invalid comment attachments.', 502);
  }

  return {
    id: value.id,
    taskId,
    userId: value.userId,
    content: value.content,
    isSystemMessage: value.isSystemMessage,
    parentCommentId: value.parentCommentId ?? null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    user: parsePerson(value.user),
    metadata: {
      ...(clientMessageId ? { clientMessageId } : {}),
      ...(mentionedUserIds ? { mentionedUserIds } : {}),
    },
    attachments: Array.isArray(value.attachments) ? value.attachments.map(parseAttachment) : [],
  };
}

function chronological(comments: TaskComment[]): TaskComment[] {
  return comments
    .map((comment, index) => ({ comment, index, at: Date.parse(comment.createdAt) }))
    .sort((left, right) => {
      if (!Number.isFinite(left.at) || !Number.isFinite(right.at)) {
        return left.index - right.index;
      }
      return left.at - right.at || left.index - right.index;
    })
    .map(({ comment }) => comment);
}

export class TaskConversationService {
  constructor(
    private readonly client: ApiClient = apiClient,
    private readonly sessions: SessionService = sessionService,
  ) {}

  async getComments(
    taskId: string,
    workspaceId: string,
    limit = 50,
    offset = 0,
    signal?: AbortSignal,
  ): Promise<ConversationPage> {
    if (!taskId || !workspaceId || !Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new ApiError('The conversation request is invalid.', 400);
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new ApiError('The conversation page is invalid.', 400);
    }

    const token = await this.sessions.getAccessToken();
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const response: unknown = await this.client.get(
      `/task-comments/task/${encodeURIComponent(taskId)}/comments?${params.toString()}`,
      { token, workspaceId, signal },
    );
    if (
      !isRecord(response) ||
      response.success !== true ||
      !Array.isArray(response.comments) ||
      !isRecord(response.pagination)
    ) {
      throw new ApiError('The backend returned an invalid conversation.', 502);
    }

    const { total, limit: responseLimit, offset: responseOffset, hasMore } = response.pagination;
    if (
      !Number.isInteger(total) ||
      Number(total) < 0 ||
      responseLimit !== limit ||
      responseOffset !== offset ||
      typeof hasMore !== 'boolean'
    ) {
      throw new ApiError('The backend returned invalid conversation pagination.', 502);
    }

    return {
      comments: chronological(response.comments.map((comment) => parseComment(comment, taskId))),
      total: Number(total),
      limit,
      offset,
      hasMore,
    };
  }

  async addComment(
    taskId: string,
    workspaceId: string,
    input: AddCommentInput,
  ): Promise<{ comment: TaskComment; duplicate: boolean }> {
    const content = input.content.trim();
    if (!taskId || !workspaceId || !content) {
      throw new ApiError('Write a comment before sending.', 400);
    }
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(input.clientMessageId)) {
      throw new ApiError('The comment retry identifier is invalid.', 400);
    }
    if (input.files && input.files.length > MAX_COMMENT_FILES) {
      throw new ApiError(`Attach no more than ${MAX_COMMENT_FILES} files to a comment.`, 400);
    }
    input.files?.forEach((file) => validateTaskFile(file.name, file.mimeType, file.size));

    const token = await this.sessions.getAccessToken();
    const body = new FormData();
    body.append('content', content);
    body.append('clientMessageId', input.clientMessageId);
    if (input.parentCommentId) body.append('parentCommentId', input.parentCommentId);
    const mentionedUserIds = [...new Set(input.mentionedUserIds ?? [])];
    if (mentionedUserIds.length) {
      body.append('mentionedUserIds', JSON.stringify(mentionedUserIds));
    }
    input.files?.forEach((file) => body.append('files', file.file, file.name));

    const response: unknown = await this.client.post(
      `/task-comments/task/${encodeURIComponent(taskId)}/comments`,
      body,
      {
        token,
        workspaceId,
        timeoutMs: input.files?.length ? 120000 : 30000,
      },
    );
    if (!isRecord(response) || response.success !== true) {
      throw new ApiError('The backend did not confirm delivery of this comment.', 502);
    }
    const comment = parseComment(response.comment, taskId);
    if (comment.metadata.clientMessageId !== input.clientMessageId) {
      throw new ApiError('The backend returned a different comment delivery identifier.', 502);
    }

    return { comment, duplicate: response.duplicate === true };
  }
}

export const taskConversationService = new TaskConversationService();
