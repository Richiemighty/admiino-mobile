import { useLocalSearchParams } from 'expo-router';

import { TaskFormScreen } from '../../src/features/tasks/TaskFormScreen';

export default function TaskEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = Array.isArray(id) ? id[0] : id;
  return <TaskFormScreen mode="edit" taskId={taskId ?? ''} />;
}
