import { AccountRoute } from '../../src/features/account/AccountRoute';
import { DeleteAccountScreen } from '../../src/features/account/DeleteAccountScreen';

export default function DeleteAccountRoute() {
  return (
    <AccountRoute>
      <DeleteAccountScreen />
    </AccountRoute>
  );
}
