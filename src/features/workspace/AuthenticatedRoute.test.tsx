import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useAuth } from '../../auth/AuthProvider';
import { AppText } from '../../components/ui';
import { renderWithProviders } from '../../test/render';
import { AuthenticatedRoute } from './AuthenticatedRoute';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));

const workspace = {
  companyId: 'workspace-1',
  role: 'member',
  status: 'active',
  isVerified: true,
  company: { id: 'workspace-1', name: 'Admiino', companyCode: 'ADM-1234' },
};

const initialState = {
  status: 'authenticated',
  workspaces: [],
  activeWorkspace: null,
  workspacePermissionStatus: 'idle',
  logout: jest.fn(async () => undefined),
};

describe('P10 authenticated routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue(initialState as never);
  });

  it('routes signed-out users to Sign In', async () => {
    jest.mocked(useAuth).mockReturnValue({ ...initialState, status: 'signed-out' } as never);
    await renderWithProviders(<AuthenticatedRoute />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sign-in'));
  });

  it('routes users without memberships to Workspace Setup', async () => {
    await renderWithProviders(<AuthenticatedRoute />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/workspace-setup'));
  });

  it('routes an eligible active workspace to the tab application', async () => {
    jest.mocked(useAuth).mockReturnValue({
      ...initialState,
      workspaces: [workspace],
      activeWorkspace: workspace,
      workspacePermissionStatus: 'ready',
    } as never);

    await renderWithProviders(<AuthenticatedRoute />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'));
  });

  it('keeps an authenticated deep-link destination open when home redirect is disabled', async () => {
    jest.mocked(useAuth).mockReturnValue({
      ...initialState,
      workspaces: [workspace],
      activeWorkspace: workspace,
      workspacePermissionStatus: 'ready',
    } as never);

    await renderWithProviders(
      <AuthenticatedRoute redirectToHome={false}>
        <AppText testID="destination">Inbox</AppText>
      </AuthenticatedRoute>,
    );

    expect(screen.getByTestId('destination')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalledWith('/(tabs)');
  });

  it('routes suspended and unavailable-permission states to restricted screens', async () => {
    jest.mocked(useAuth).mockReturnValue({
      ...initialState,
      workspaces: [workspace],
      activeWorkspace: workspace,
      workspacePermissionStatus: 'suspended',
    } as never);
    await renderWithProviders(<AuthenticatedRoute />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/workspace-suspended'));

    jest.mocked(router.replace).mockClear();
    jest.mocked(useAuth).mockReturnValue({
      ...initialState,
      workspaces: [workspace],
      workspacePermissionStatus: 'error',
    } as never);
    await renderWithProviders(<AuthenticatedRoute />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/workspace-access'));
  });
});
