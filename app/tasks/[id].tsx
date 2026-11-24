import { useLocalSearchParams } from 'expo-router';

import { TaskDetailsScreen } from '../../src/features/tasks/TaskDetailsScreen';

export default function TaskDetailsRoute() {
  const { id, projectId, fromProject } = useLocalSearchParams<{
    id: string;
    projectId?: string;
    fromProject?: string;
  }>();
  const taskId = Array.isArray(id) ? id[0] : id;
  const contextProjectId = Array.isArray(projectId) ? projectId[0] : projectId;
  const cameFromProject = Array.isArray(fromProject) ? fromProject[0] === '1' : fromProject === '1';
  return (
    <TaskDetailsScreen
      returnProjectId={cameFromProject ? contextProjectId : undefined}
      taskId={taskId ?? ''}
    />
  );
}
