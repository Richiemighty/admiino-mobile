import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiNetworkError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { renderWithProviders } from '../../test/render';
import { type TaskComment, taskConversationService } from './conversationService';
import { taskService } from './service';
import { TaskConversationScreen } from './TaskConversationScreen';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'client-message-123' }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  File: class {
    exists = false;
  },
  Paths: { cache: {} },
}));
jest.mock('./service', () => ({
  ...jest.requireActual<typeof import('./service')>('./service'),
  taskService: {
    getTask: jest.fn(),
    getMembers: jest.fn(),
    getTeams: jest.fn(),
  },
}));
jest.mock('./conversationService', () => ({
  ...jest.requireActual<typeof import('./conversationService')>('./conversationService'),
  taskConversationService: {
    getComments: jest.fn(),
    addComment: jest.fn(),
  },
}));

const workspace = {
  companyId: 'conversation-workspace',
  role: 'member',
  status: 'active',
  isVerified: true,
  company: { id: 'conversation-workspace', name: 'Conversation Workspace' },
};

const task = {
  id: 'conversation-task',
  companyId: workspace.companyId,
  title: 'Review launch plan',
  description: 'Check the final milestones.',
  status: 'pending' as const,
  priority: 'high' as const,
  deadline: null,
  projectId: null,
  teamId: null,
  creator: { id: 'user-2', firstName: 'Taylor', lastName: 'Teammate' },
  assignee: { id: 'user-1', firstName: 'Sam', lastName: 'Member' },
  assignees: [],
  attachments: [],
};

function authState() {
  return {
    status: 'authenticated',
    user: { id: 'user-1', firstName: 'Sam', lastName: 'Member', role: 'member' },
    workspaces: [workspace],
    activeWorkspace: workspace,
    selectedWorkspaceId: workspace.companyId,
    permissions: {
      companyId: workspace.companyId,
      userId: 'user-1',
      role: 'member',
      rolePermissions: {},
      individualOverrides: {},
      permissions: {},
    },
    workspacePermissionStatus: 'ready',
    logout: jest.fn(async () => undefined),
  } as never;
}

function comment(
  id: string,
  content: string,
  createdAt: string,
  clientMessageId?: string,
): TaskComment {
  return {
    id,
    taskId: task.id,
    userId: 'user-2',
    content,
    isSystemMessage: false,
    parentCommentId: null,
    createdAt,
    user: { id: 'user-2', firstName: 'Taylor', lastName: 'Teammate' },
    metadata: clientMessageId ? { clientMessageId } : {},
    attachments: [],
  };
}

describe('P15 task conversation screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue(authState());
    jest.mocked(taskService.getTask).mockResolvedValue({
      task,
      access: { canView: true, canEdit: true, readOnly: false },
    });
    jest.mocked(taskConversationService.getComments).mockResolvedValue({
      comments: [
        comment('comment-new', 'Second update', '2026-04-04T10:00:00.000Z'),
        comment('comment-old', 'First update', '2026-04-03T10:00:00.000Z'),
      ],
      total: 2,
      limit: 50,
      offset: 0,
      hasMore: false,
    });
    jest
      .mocked(taskConversationService.addComment)
      .mockImplementation(async (_taskId, _workspaceId, input) => ({
        duplicate: false,
        comment: comment(
          'comment-sent',
          input.content,
          '2026-04-05T10:00:00.000Z',
          input.clientMessageId,
        ),
      }));
  });

  it('renders comments chronologically and sends a trimmed comment once', async () => {
    await renderWithProviders(<TaskConversationScreen taskId={task.id} />);

    expect(await screen.findByText('First update')).toBeTruthy();
    const visibleComments = screen.getAllByText(/(?:First|Second) update/);
    expect(visibleComments.map((node) => node.props.children)).toEqual([
      'First update',
      'Second update',
    ]);

    await fireEvent.changeText(screen.getByLabelText('Write a comment'), '  New note  ');
    const send = screen.getByRole('button', { name: 'Send comment' });
    expect(send.props.accessibilityState?.disabled).toBe(false);
    await fireEvent.press(send);
    await fireEvent.press(send);

    await waitFor(() => expect(taskConversationService.addComment).toHaveBeenCalledTimes(1));
    expect(taskConversationService.addComment).toHaveBeenCalledWith(
      task.id,
      workspace.companyId,
      expect.objectContaining({
        content: 'New note',
        clientMessageId: 'client-message-123',
      }),
    );
    expect(await screen.findByText('New note')).toBeTruthy();
  });

  it('keeps task-access read-only conversations free of a composer', async () => {
    jest.mocked(taskService.getTask).mockResolvedValueOnce({
      task,
      access: { canView: true, canEdit: false, readOnly: true },
    });
    await renderWithProviders(<TaskConversationScreen taskId={task.id} />);

    expect(await screen.findByText('First update')).toBeTruthy();
    expect(screen.queryByLabelText('Write a comment')).toBeNull();
    expect(taskConversationService.addComment).not.toHaveBeenCalled();
  });

  it('only submits mentions selected from eligible task-team members', async () => {
    jest.mocked(taskService.getTask).mockResolvedValueOnce({
      task: { ...task, teamId: 'team-1' },
      access: { canView: true, canEdit: true, readOnly: false },
    });
    jest
      .mocked(taskService.getTeams)
      .mockResolvedValueOnce([{ id: 'team-1', name: 'Team One', memberIds: ['user-3'] }]);
    jest.mocked(taskService.getMembers).mockResolvedValueOnce([
      {
        userId: 'user-3',
        firstName: 'Alex',
        lastName: 'Colleague',
      },
    ]);

    await renderWithProviders(<TaskConversationScreen taskId={task.id} />);
    await screen.findByText('First update');
    await fireEvent.changeText(screen.getByLabelText('Write a comment'), 'Thanks @Al');
    await fireEvent.press(await screen.findByRole('button', { name: 'Mention Alex Colleague' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send comment' }));

    await waitFor(() => expect(taskConversationService.addComment).toHaveBeenCalledTimes(1));
    expect(taskConversationService.addComment).toHaveBeenCalledWith(
      task.id,
      workspace.companyId,
      expect.objectContaining({
        content: 'Thanks @Alex Colleague',
        mentionedUserIds: ['user-3'],
      }),
    );
  });

  it('loads earlier pages without duplicating comments', async () => {
    jest
      .mocked(taskConversationService.getComments)
      .mockResolvedValueOnce({
        comments: [comment('comment-latest', 'Latest update', '2026-04-04T10:00:00.000Z')],
        total: 60,
        limit: 50,
        offset: 0,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        comments: [comment('comment-latest', 'Latest update', '2026-04-04T10:00:00.000Z')],
        total: 60,
        limit: 50,
        offset: 10,
        hasMore: false,
      })
      .mockResolvedValueOnce({
        comments: [comment('comment-earlier', 'Earlier update', '2026-04-03T10:00:00.000Z')],
        total: 60,
        limit: 50,
        offset: 0,
        hasMore: false,
      });

    await renderWithProviders(<TaskConversationScreen taskId="paged-task" />);
    expect(await screen.findByText('Latest update')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Load earlier comments' }));

    expect(await screen.findByText('Earlier update')).toBeTruthy();
    expect(screen.getAllByText('Latest update')).toHaveLength(1);
    expect(taskConversationService.getComments).toHaveBeenLastCalledWith(
      'paged-task',
      workspace.companyId,
      50,
      0,
      expect.any(AbortSignal),
    );
  });

  it('reconciles an uncertain send before retrying with the same idempotency key', async () => {
    jest.mocked(taskService.getTask).mockResolvedValue({
      task: { ...task, id: 'retry-task' },
      access: { canView: true, canEdit: true, readOnly: false },
    });
    jest
      .mocked(taskConversationService.getComments)
      .mockResolvedValueOnce({
        comments: [],
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false,
      })
      .mockResolvedValue({
        comments: [],
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false,
      });
    jest
      .mocked(taskConversationService.addComment)
      .mockRejectedValueOnce(new ApiNetworkError())
      .mockImplementationOnce(async (_taskId, _workspaceId, input) => ({
        duplicate: false,
        comment: comment(
          'comment-retried',
          input.content,
          '2026-04-05T10:00:00.000Z',
          input.clientMessageId,
        ),
      }));

    await renderWithProviders(<TaskConversationScreen taskId="retry-task" />);
    await screen.findByLabelText('Write a comment');
    await waitFor(() => expect(taskConversationService.getComments).toHaveBeenCalled());
    await fireEvent.changeText(screen.getByLabelText('Write a comment'), 'Retry safely');
    expect(screen.getByDisplayValue('Retry safely')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Send comment' }));

    const retry = await screen.findByRole('button', {
      name: 'Check delivery and retry comment',
    });
    await fireEvent.press(retry);

    await waitFor(() => expect(taskConversationService.addComment).toHaveBeenCalledTimes(2));
    expect(taskConversationService.addComment).toHaveBeenNthCalledWith(
      1,
      'retry-task',
      workspace.companyId,
      expect.objectContaining({ clientMessageId: 'client-message-123' }),
    );
    expect(taskConversationService.addComment).toHaveBeenNthCalledWith(
      2,
      'retry-task',
      workspace.companyId,
      expect.objectContaining({ clientMessageId: 'client-message-123' }),
    );
  });
});
