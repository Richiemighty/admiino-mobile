import { useLocalSearchParams } from 'expo-router';

import { ProjectDetailsScreen } from '../../src/features/projects/ProjectDetailsScreen';

export default function ProjectDetailsRoute() {
  const { id, tab, returnTo } = useLocalSearchParams<{
    id: string;
    tab?: string;
    returnTo?: string;
  }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const initialSection = Array.isArray(tab) ? tab[0] : tab;
  const cameFromInbox = Array.isArray(returnTo) ? returnTo[0] === 'inbox' : returnTo === 'inbox';
  return (
    <ProjectDetailsScreen
      initialSection={initialSection}
      projectId={projectId ?? ''}
      returnToInbox={cameFromInbox}
    />
  );
}
