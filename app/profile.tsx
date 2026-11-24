import { AccountRoute } from '../src/features/account/AccountRoute';
import { ProfileScreen } from '../src/features/account/ProfileScreen';

export default function ProfileRoute() {
  return (
    <AccountRoute>
      <ProfileScreen />
    </AccountRoute>
  );
}
