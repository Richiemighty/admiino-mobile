import { useLocalSearchParams } from 'expo-router';

import { TaskFormScreen } from '../../src/features/tasks/TaskFormScreen';

export default function TaskEditRoute() {
  const { id, projectId, fromProject } = useLocalSearchParams<{
    id: string;
    projectId?: string;
    fromProject?: string;
  }>();
  const taskId = Array.isArray(id) ? id[0] : id;
  const contextProjectId = Array.isArray(projectId) ? projectId[0] : projectId;
  const cameFromProject = Array.isArray(fromProject) ? fromProject[0] === '1' : fromProject === '1';
  return (
    <TaskFormScreen
      mode="edit"
      returnProjectId={cameFromProject ? contextProjectId : undefined}
      taskId={taskId ?? ''}
    />
  );
}
