import { useLocalSearchParams } from 'expo-router';

import { ProjectDetailsScreen } from '../../src/features/projects/ProjectDetailsScreen';

export default function ProjectDetailsRoute() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const initialSection = Array.isArray(tab) ? tab[0] : tab;
  return <ProjectDetailsScreen initialSection={initialSection} projectId={projectId ?? ''} />;
}
