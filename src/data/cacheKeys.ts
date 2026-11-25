import { cacheKey } from './serverCache';

export const cacheKeys = {
  tasks: (userId: string, workspaceId: string, listKey: string) =>
    cacheKey('workspace', workspaceId, 'user', userId, 'tasks', listKey),
  task: (userId: string, workspaceId: string, taskId: string) =>
    cacheKey('workspace', workspaceId, 'user', userId, 'task', taskId),
  watchers: (userId: string, workspaceId: string, taskId: string) =>
    cacheKey('workspace', workspaceId, 'user', userId, 'watchers', taskId),
  home: (userId: string, workspaceId: string) =>
    cacheKey('workspace', workspaceId, 'user', userId, 'home'),
  projects: (userId: string, workspaceId: string, search: string) =>
    cacheKey('workspace', workspaceId, 'user', userId, 'projects', search),
  project: (userId: string, workspaceId: string, projectId: string) =>
    cacheKey('workspace', workspaceId, 'user', userId, 'project', projectId),
  projectFiles: (userId: string, workspaceId: string, projectId: string, folderId?: string) =>
    cacheKey('workspace', workspaceId, 'user', userId, 'project-files', projectId, folderId),
  teams: (userId: string, workspaceId: string) =>
    cacheKey('workspace', workspaceId, 'user', userId, 'teams'),
  inbox: (userId: string, workspaceId: string, filter: string) =>
    cacheKey('workspace', workspaceId, 'user', userId, 'inbox', filter),
};
