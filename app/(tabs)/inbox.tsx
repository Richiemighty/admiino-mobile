import { Inbox } from 'lucide-react-native';

import { FeaturePlaceholder } from '../../src/features/home/FeaturePlaceholder';

export default function InboxScreen() {
  return (
    <FeaturePlaceholder
      Icon={Inbox}
      description="Workspace activity updates and requests will appear here when the activity feed is connected. This is not a messaging inbox."
      title="Inbox"
    />
  );
}
