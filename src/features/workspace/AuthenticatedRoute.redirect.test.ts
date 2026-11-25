import { describe, expect, it } from '@jest/globals';

import { getAuthenticatedRouteRedirect } from './AuthenticatedRoute';

describe('authenticated protected-route redirect decisions', () => {
  const ready = {
    status: 'authenticated',
    workspaceCount: 1,
    activeWorkspace: true,
    workspacePermissionStatus: 'ready',
  };

  it('terminates on a ready destination without falling through to workspace selection', () => {
    expect(getAuthenticatedRouteRedirect({ ...ready, redirectToHome: false })).toBeNull();
    expect(getAuthenticatedRouteRedirect({ ...ready, redirectToHome: true })).toBe('/(tabs)');
  });

  it('preserves authentication and workspace protection decisions', () => {
    expect(
      getAuthenticatedRouteRedirect({ ...ready, status: 'signed-out', redirectToHome: false }),
    ).toBe('/sign-in');
    expect(
      getAuthenticatedRouteRedirect({
        ...ready,
        workspacePermissionStatus: 'error',
        redirectToHome: false,
      }),
    ).toBe('/workspace-access');
    expect(
      getAuthenticatedRouteRedirect({ ...ready, activeWorkspace: false, redirectToHome: false }),
    ).toBe('/workspace-select');
  });
});
