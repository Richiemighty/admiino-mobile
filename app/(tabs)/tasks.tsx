import { ListTodo } from 'lucide-react-native';

import { FeaturePlaceholder } from '../../src/features/home/FeaturePlaceholder';

export default function TasksScreen() {
  return (
    <FeaturePlaceholder
      Icon={ListTodo}
      description="Task lists are not connected in this phase. No task data or actions are available yet."
      title="Tasks"
    />
  );
}
