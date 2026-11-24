import { InboxScreen } from '../src/features/inbox/InboxScreen';
import { AuthenticatedRoute } from '../src/features/workspace/AuthenticatedRoute';

export default function InboxRoute() {
  return (
    <AuthenticatedRoute>
      <InboxScreen />
    </AuthenticatedRoute>
  );
}
