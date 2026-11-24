import { useLocalSearchParams } from 'expo-router';

import { TaskFormScreen } from '../src/features/tasks/TaskFormScreen';

export default function TaskCreateRoute() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const contextProjectId = Array.isArray(projectId) ? projectId[0] : projectId;
  return <TaskFormScreen mode="create" projectId={contextProjectId} />;
}
