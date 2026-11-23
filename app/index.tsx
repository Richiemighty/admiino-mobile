import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '../src/auth/AuthProvider';
import { AppScreen, InlineError, LoadingState } from '../src/components/ui';
import { onboardingRoutes } from '../src/features/onboarding/routes';
import { isOnboardingCompleted } from '../src/features/onboarding/storage';

export default function Index() {
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(false);
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'restoring') return;
    let active = true;
    if (status === 'authenticated' || status === 'access-denied' || status === 'suspended') {
      router.replace('/authenticated');
      return;
    }
    isOnboardingCompleted().then(
      (completed) => {
        if (active) {
          router.replace(completed ? onboardingRoutes.accountChoice : onboardingRoutes.welcome);
        }
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, status]);

  return (
    <AppScreen padding="xl">
      {error ? (
        <InlineError
          message="We could not check your onboarding status."
          onRetry={() => {
            setError(false);
            setAttempt((current) => current + 1);
          }}
          retryLabel="Try again"
        />
      ) : (
        <LoadingState label="Preparing your Admiino experience" variant="fullScreen" />
      )}
    </AppScreen>
  );
}
