import { AccountRoute } from '../src/features/account/AccountRoute';
import { SettingsScreen } from '../src/features/account/SettingsScreen';

export default function SettingsRoute() {
  return (
    <AccountRoute>
      <SettingsScreen />
    </AccountRoute>
  );
}
