import { useLocalSearchParams } from 'expo-router';

import { TaskDetailsScreen } from '../../src/features/tasks/TaskDetailsScreen';

export default function TaskDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = Array.isArray(id) ? id[0] : id;
  return <TaskDetailsScreen taskId={taskId ?? ''} />;
}
