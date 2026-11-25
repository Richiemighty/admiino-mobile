import type { EffectiveWorkspacePermissions } from '../api/types';
import type { TaskAccess } from '../features/tasks/service';

export const permissionRoles = [
  'owner',
  'admin',
  'manager',
  'member',
  'guest',
  'external_viewer',
] as const;

export type PermissionRole = (typeof permissionRoles)[number];

export function workspacePermissions(
  role: PermissionRole,
  permissions: Record<string, boolean> = {},
  userId = 'user-1',
): EffectiveWorkspacePermissions {
  return {
    companyId: 'workspace-1',
    userId,
    role,
    rolePermissions: permissions,
    individualOverrides: {},
    permissions,
  };
}

export function taskAccess(values: Partial<TaskAccess> = {}): TaskAccess {
  return {
    canView: true,
    canEdit: false,
    readOnly: true,
    ...values,
  };
}
