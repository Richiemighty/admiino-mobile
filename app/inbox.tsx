import { InboxScreen } from '../src/features/inbox/InboxScreen';
import { AuthenticatedRoute } from '../src/features/workspace/AuthenticatedRoute';

export function InboxRoute() {
  return (
    <AuthenticatedRoute redirectToHome={false}>
      <InboxScreen />
    </AuthenticatedRoute>
  );
}

export default InboxRoute;
