import { describe, expect, it } from '@jest/globals';

import { ApiClient } from '../../api';
import { SessionService } from '../../auth/session';
import type { SecureSessionStorage } from '../../auth/sessionStorage';
import { TaskConversationService } from './conversationService';

const workspaceId = 'workspace-1';
const taskId = 'task-1';

const storage: SecureSessionStorage = {
  getAccessToken: async () => 'secure-access-token',
  setAccessToken: async () => undefined,
  clearAccessToken: async () => undefined,
  getActiveWorkspaceId: async () => null,
  setActiveWorkspaceId: async () => undefined,
  clearActiveWorkspaceId: async () => undefined,
  clearSession: async () => undefined,
};

function serviceFor(
  respond: (url: URL, init: RequestInit) => unknown,
  requests: { url: URL; init: RequestInit }[] = [],
): TaskConversationService {
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    return new Response(JSON.stringify(respond(url, init)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return new TaskConversationService(
    new ApiClient('https://api.admiino.com/api/v1', fetchImpl),
    new SessionService(storage),
  );
}

function comment(id: string, createdAt: string) {
  return {
    id,
    taskId,
    userId: 'user-1',
    content: id,
    isSystemMessage: false,
    parentCommentId: null,
    createdAt,
    user: { id: 'user-1', firstName: 'Alex', lastName: 'Member' },
    metadata: {},
    attachments: [
      {
        id: `file-${id}`,
        fileName: 'brief.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        fileUrl: 'https://private-storage.example/file',
        publicId: 'must-not-escape',
        downloadUrl: '/api/v1/tasks/task-1/attachments/file-1/download',
      },
    ],
  };
}

describe('P15 task conversation API contracts', () => {
  it('uses the verified pagination contract and returns comments chronologically', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor(
      () => ({
        success: true,
        comments: [
          comment('newer', '2026-04-04T10:00:00.000Z'),
          comment('older', '2026-04-03T10:00:00.000Z'),
        ],
        pagination: { total: 72, limit: 50, offset: 22, hasMore: false },
      }),
      requests,
    );

    await expect(service.getComments(taskId, workspaceId, 50, 22)).resolves.toMatchObject({
      total: 72,
      limit: 50,
      offset: 22,
      hasMore: false,
      comments: [{ id: 'older' }, { id: 'newer' }],
    });

    expect(requests[0]?.url.pathname).toBe('/api/v1/task-comments/task/task-1/comments');
    expect(requests[0]?.url.searchParams.get('limit')).toBe('50');
    expect(requests[0]?.url.searchParams.get('offset')).toBe('22');
    expect(new Headers(requests[0]?.init.headers).get('Authorization')).toBe(
      'Bearer secure-access-token',
    );
    expect(new Headers(requests[0]?.init.headers).get('x-company-id')).toBe(workspaceId);
    expect(
      (await service.getComments(taskId, workspaceId, 50, 22)).comments[0]?.attachments[0],
    ).not.toHaveProperty('fileUrl');
  });

  it('sends replies, mentions, attachments and one stable idempotency key as multipart data', async () => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const service = serviceFor((_url, init) => {
      const body = init.body;
      expect(body).toBeInstanceOf(FormData);
      const formData = body as FormData;
      expect(formData.get('content')).toBe('A reply');
      expect(formData.get('clientMessageId')).toBe('client-message-123');
      expect(formData.get('parentCommentId')).toBe('comment-parent');
      expect(formData.get('mentionedUserIds')).toBe('["user-2"]');
      return {
        success: true,
        duplicate: true,
        comment: {
          ...comment('comment-new', '2026-04-04T10:00:00.000Z'),
          content: 'A reply',
          parentCommentId: 'comment-parent',
          metadata: {
            clientMessageId: 'client-message-123',
            mentionedUserIds: ['user-2'],
          },
        },
      };
    }, requests);

    await expect(
      service.addComment(taskId, workspaceId, {
        content: '  A reply  ',
        clientMessageId: 'client-message-123',
        parentCommentId: 'comment-parent',
        mentionedUserIds: ['user-2', 'user-2'],
      }),
    ).resolves.toMatchObject({
      duplicate: true,
      comment: {
        parentCommentId: 'comment-parent',
        metadata: { clientMessageId: 'client-message-123' },
      },
    });

    expect(requests[0]?.url.pathname).toBe('/api/v1/task-comments/task/task-1/comments');
    expect(requests[0]?.init.method).toBe('POST');
    expect(new Headers(requests[0]?.init.headers).get('Content-Type')).toBeNull();
    expect(new Headers(requests[0]?.init.headers).get('x-company-id')).toBe(workspaceId);
  });

  it('rejects invalid pagination and refuses comments that belong to another task', async () => {
    const service = serviceFor(() => ({
      success: true,
      comments: [comment('comment-1', '2026-04-04T10:00:00.000Z')],
      pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
    }));

    await expect(service.getComments(taskId, workspaceId, 51, 0)).rejects.toMatchObject({
      status: 400,
    });
    const otherTask = serviceFor(() => ({
      success: true,
      comments: [{ ...comment('comment-1', '2026-04-04T10:00:00.000Z'), taskId: 'task-2' }],
      pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
    }));
    await expect(otherTask.getComments(taskId, workspaceId)).rejects.toMatchObject({
      status: 502,
    });
  });
});
