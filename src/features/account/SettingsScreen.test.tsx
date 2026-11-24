import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { renderWithProviders } from '../../test/render';
import { ThemeProvider } from '../../theme';
import { AppearanceSettingsScreen } from './AppearanceSettingsScreen';
import { DeleteAccountScreen } from './DeleteAccountScreen';
import { profileService } from './service';
import { SettingsScreen } from './SettingsScreen';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('./service', () => ({
  profileService: {
    updateProfile: jest.fn(),
    uploadProfilePicture: jest.fn(),
    requestPasswordReset: jest.fn(),
  },
}));

const logout = jest.fn(async () => undefined);

function authState() {
  return {
    status: 'authenticated',
    user: {
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.test',
    },
    logout,
  } as never;
}

describe('P16 settings and account deletion limitation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue(authState());
    jest.mocked(profileService.requestPasswordReset).mockResolvedValue();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Sign out')?.onPress?.();
    });
  });

  it('navigates to theme and the existing notification preferences', async () => {
    await renderWithProviders(<SettingsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'App appearance' }));
    expect(router.push).toHaveBeenCalledWith('/settings/appearance');
    await fireEvent.press(screen.getByRole('button', { name: 'Notification preferences' }));
    expect(router.push).toHaveBeenCalledWith('/notification-settings');
  });

  it('selects System, Light, and Dark appearance options', async () => {
    await renderWithProviders(
      <ThemeProvider initialMode="system">
        <AppearanceSettingsScreen />
      </ThemeProvider>,
    );
    expect(
      screen.getByLabelText('System Default appearance').props.accessibilityState.selected,
    ).toBe(true);

    await fireEvent.press(screen.getByLabelText('Dark appearance'));
    await waitFor(() =>
      expect(screen.getByLabelText('Dark appearance').props.accessibilityState.selected).toBe(true),
    );
    await fireEvent.press(screen.getByLabelText('Light appearance'));
    await waitFor(() =>
      expect(screen.getByLabelText('Light appearance').props.accessibilityState.selected).toBe(
        true,
      ),
    );
    await fireEvent.press(screen.getByLabelText('System Default appearance'));
    await waitFor(() =>
      expect(
        screen.getByLabelText('System Default appearance').props.accessibilityState.selected,
      ).toBe(true),
    );
  });

  it('uses the existing password-reset contract and confirms only the requested outcome', async () => {
    await renderWithProviders(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Send password reset link' }));

    await waitFor(() =>
      expect(profileService.requestPasswordReset).toHaveBeenCalledWith('ada@example.test'),
    );
    expect(
      await screen.findByText(/password reset instructions will be sent shortly/),
    ).toBeTruthy();
  });

  it('clears the local session on confirmed sign out', async () => {
    await renderWithProviders(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith('/sign-in');
    });
  });

  it('shows the B-08 deletion blocker without exposing a fake destructive action', async () => {
    await renderWithProviders(<DeleteAccountScreen />);

    expect(await screen.findByText('Account deletion is unavailable')).toBeTruthy();
    expect(screen.getByText(/No deletion request has been submitted/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete My Account' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Contact Support for account deletion guidance' }),
    ).toBeTruthy();
  });
});
