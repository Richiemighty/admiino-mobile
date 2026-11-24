import { useLocalSearchParams } from 'expo-router';

import { TaskFormScreen } from '../src/features/tasks/TaskFormScreen';

export default function TaskCreateRoute() {
  const { projectId, teamId, returnToProject } = useLocalSearchParams<{
    projectId?: string;
    teamId?: string;
    returnToProject?: string;
  }>();
  const contextProjectId = Array.isArray(projectId) ? projectId[0] : projectId;
  const contextTeamId = Array.isArray(teamId) ? teamId[0] : teamId;
  const shouldReturnToProject = Array.isArray(returnToProject)
    ? returnToProject[0] === '1'
    : returnToProject === '1';
  return (
    <TaskFormScreen
      mode="create"
      projectId={contextProjectId}
      returnToProject={shouldReturnToProject}
      teamId={contextTeamId}
    />
  );
}
