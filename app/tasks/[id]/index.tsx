import { useLocalSearchParams } from 'expo-router';

import { TaskDetailsScreen } from '../../../src/features/tasks/TaskDetailsScreen';

export default function TaskDetailsRoute() {
  const { id, projectId, fromProject, returnTo } = useLocalSearchParams<{
    id: string;
    projectId?: string;
    fromProject?: string;
    returnTo?: string;
  }>();
  const taskId = Array.isArray(id) ? id[0] : id;
  const contextProjectId = Array.isArray(projectId) ? projectId[0] : projectId;
  const cameFromProject = Array.isArray(fromProject) ? fromProject[0] === '1' : fromProject === '1';
  const cameFromInbox = Array.isArray(returnTo) ? returnTo[0] === 'inbox' : returnTo === 'inbox';
  return (
    <TaskDetailsScreen
      returnToInbox={cameFromInbox}
      returnProjectId={cameFromProject ? contextProjectId : undefined}
      taskId={taskId ?? ''}
    />
  );
}
