import type { EffectiveWorkspacePermissions } from '../../api/types';
import type {
  EmbeddedProjectMember,
  ProjectGovernanceCapabilities,
  ProjectMember,
  ProjectRecord,
} from './service';

const INTERNAL_ROLES = ['owner', 'admin', 'manager', 'member'];
const PROJECT_EDIT_ROLES = ['owner', 'admin', 'manager'];

export function canCreateProjects(
  permissions: EffectiveWorkspacePermissions | null,
  governance: ProjectGovernanceCapabilities | null,
): boolean {
  return (
    permissions !== null &&
    INTERNAL_ROLES.includes(permissions.role) &&
    permissions.permissions.create_projects === true &&
    governance?.projectCreationRestricted === false
  );
}

export function canCreateProjectTasks(permissions: EffectiveWorkspacePermissions | null): boolean {
  return (
    permissions !== null &&
    INTERNAL_ROLES.includes(permissions.role) &&
    permissions.permissions.create_project_tasks === true
  );
}

function isActiveProjectAdmin(member: ProjectMember): boolean {
  return member.status === 'active' && ['owner', 'admin'].includes(member.role);
}

function currentUserProjectMember(
  members: EmbeddedProjectMember[] | undefined,
  userId: string,
): boolean {
  return Boolean(
    members?.some((member) => {
      const membership = member.ProjectMember ?? member.projectMember;
      const role = member.role ?? membership?.role;
      const status = member.status ?? membership?.status;
      return member.id === userId && role !== undefined && status === 'active';
    }),
  );
}

export function isMyProject(project: ProjectRecord, userId: string): boolean {
  return (
    project.createdBy === userId ||
    project.leadId === userId ||
    currentUserProjectMember(project.members, userId)
  );
}

export function canEditProject(
  permissions: EffectiveWorkspacePermissions | null,
  members: ProjectMember[],
): boolean {
  return (
    (permissions !== null && PROJECT_EDIT_ROLES.includes(permissions.role)) ||
    Boolean(
      permissions?.userId &&
      members.some((member) => member.id === permissions.userId && isActiveProjectAdmin(member)),
    )
  );
}
