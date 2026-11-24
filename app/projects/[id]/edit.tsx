import { useLocalSearchParams } from 'expo-router';

import { ProjectFormScreen } from '../../../src/features/projects/ProjectFormScreen';

export default function ProjectEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  return <ProjectFormScreen mode="edit" projectId={projectId ?? ''} />;
}
