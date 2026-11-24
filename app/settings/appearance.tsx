import { AccountRoute } from '../../src/features/account/AccountRoute';
import { AppearanceSettingsScreen } from '../../src/features/account/AppearanceSettingsScreen';

export default function AppearanceSettingsRoute() {
  return (
    <AccountRoute>
      <AppearanceSettingsScreen />
    </AccountRoute>
  );
}
