import { FolderKanban } from 'lucide-react-native';

import { FeaturePlaceholder } from '../../src/features/home/FeaturePlaceholder';

export default function ProjectsScreen() {
  return (
    <FeaturePlaceholder
      Icon={FolderKanban}
      description="Project data is not connected in this phase. No project information or actions are available yet."
      title="Projects"
    />
  );
}
