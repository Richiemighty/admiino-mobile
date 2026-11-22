import { Redirect } from 'expo-router';
import type { PropsWithChildren } from 'react';

export interface DevelopmentOnlyRouteProps extends PropsWithChildren {
  enabled: boolean;
}

export function DevelopmentOnlyRoute({ enabled, children }: DevelopmentOnlyRouteProps) {
  if (!enabled) {
    return <Redirect href="/" />;
  }

  return <>{children}</>;
}
