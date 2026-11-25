import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, screen } from '@testing-library/react-native';

import { InboxRoute } from '../../../app/inbox';
import { useAuth } from '../../auth/AuthProvider';
import { renderWithProviders } from '../../test/render';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('./InboxScreen', () => ({
  InboxScreen: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Canonical Inbox page</Text>;
  },
}));

const mockUseAuth = jest.mocked(useAuth);
const mockRouter = (jest.requireMock('expo-router') as { router: { replace: jest.Mock } }).router;

function authenticatedAuth() {
  return {
    status: 'authenticated' as const,
    workspaces: [{ companyId: 'workspace-1' }],
    activeWorkspace: { companyId: 'workspace-1' },
    workspacePermissionStatus: 'ready' as const,
    logout: jest.fn(async () => undefined),
  };
}

describe('canonical Inbox route', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('renders the Inbox child and does not redirect a ready workspace to Home', async () => {
    mockUseAuth.mockReturnValue(authenticatedAuth() as never);

    await renderWithProviders(<InboxRoute />);

    expect(screen.getByText('Canonical Inbox page')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('preserves the protected signed-out redirect', async () => {
    mockUseAuth.mockReturnValue({
      ...authenticatedAuth(),
      status: 'signed-out',
    } as never);

    await renderWithProviders(<InboxRoute />);

    expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in');
  });
});
