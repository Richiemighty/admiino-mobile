import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import MainTabsLayout from '../../app/(tabs)/_layout';
import { useAuth } from '../auth/AuthProvider';
import { renderWithProviders } from '../test/render';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));

describe('P10 main tab structure', () => {
  beforeEach(() => {
    jest.mocked(router.replace).mockClear();
    jest.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      activeWorkspace: {
        companyId: 'workspace-1',
        role: 'member',
        status: 'active',
        isVerified: true,
        company: { id: 'workspace-1', name: 'Admiino', companyCode: 'ADM-1234' },
      },
      workspacePermissionStatus: 'ready',
    } as never);
  });

  it('keeps the five role-independent tabs in the required order', async () => {
    await renderWithProviders(<MainTabsLayout />);

    expect(screen.getAllByTestId(/tab-screen-/).map((element) => element.props.testID)).toEqual([
      'tab-screen-index',
      'tab-screen-tasks',
      'tab-screen-projects',
      'tab-screen-inbox',
      'tab-screen-more',
    ]);
  });

  it('redirects signed-out deep links instead of exposing an authenticated tab route', async () => {
    jest.mocked(useAuth).mockReturnValue({
      status: 'signed-out',
      activeWorkspace: null,
      workspacePermissionStatus: 'idle',
    } as never);

    await renderWithProviders(<MainTabsLayout />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sign-in'));
  });
});
