import { router } from 'expo-router';
import { type PropsWithChildren, useEffect } from 'react';

import { useAuth } from '../../auth/AuthProvider';
import { AppScreen, LoadingState } from '../../components/ui';

export function AccountRoute({ children }: PropsWithChildren) {
  const { status, user } = useAuth();

  useEffect(() => {
    if (status === 'signed-out' || (!user && status !== 'restoring')) {
      router.replace('/sign-in');
    }
  }, [status, user]);

  if (status === 'restoring' || !user) {
    return (
      <AppScreen>
        <LoadingState label="Verifying your account" variant="fullScreen" />
      </AppScreen>
    );
  }

  return children;
}
