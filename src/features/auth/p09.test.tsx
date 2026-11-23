import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { apiClient, ApiError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { sessionService } from '../../auth/session';
import { renderWithProviders } from '../../test/render';
import { ActivationScreen } from './ActivationScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { InvitationScreen } from './InvitationScreen';
import { ResetPasswordScreen } from './ResetPasswordScreen';
import { VerifyEmailScreen } from './VerifyEmailScreen';

jest.mock('../../api', () => {
  const actual = jest.requireActual<typeof import('../../api')>('../../api');
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn() } };
});

jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(async () => ({ type: 'opened' })),
}));
jest.mock('./AuthScreen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AuthScreen: ({
      children,
      footer,
      title,
    }: {
      children?: React.ReactNode;
      footer?: React.ReactNode;
      title: string;
    }) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, { accessibilityRole: 'header' }, title),
        children,
        footer,
      ),
  };
});

describe('P09 account recovery and activation', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest
      .mocked(useLocalSearchParams)
      .mockReset()
      .mockReturnValue({} as never);
    jest
      .mocked(apiClient.get)
      .mockReset()
      .mockResolvedValue({} as never);
    jest
      .mocked(apiClient.post)
      .mockReset()
      .mockResolvedValue({ status: 'success' } as never);
    jest
      .mocked(WebBrowser.openBrowserAsync)
      .mockReset()
      .mockResolvedValue({ type: 'opened' } as never);
    jest.mocked(useAuth).mockReset();
    jest.mocked(useAuth).mockReturnValue({
      status: 'signed-out',
      restore: jest.fn(async () => undefined),
    } as never);
  });

  it('shows generic recovery confirmation only after an accepted request', async () => {
    jest.mocked(apiClient.post).mockResolvedValueOnce({ status: 'success' } as never);
    await renderWithProviders(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'user@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
    await waitFor(() =>
      expect(
        screen.getByText(
          /If that email is registered, you will receive password reset instructions/,
        ),
      ).toBeTruthy(),
    );
    expect(apiClient.post).toHaveBeenCalledWith('/auth/forgot-password', {
      email: 'user@example.com',
    });
  });

  it('does not confirm a failed recovery request and explains rate limiting', async () => {
    jest.mocked(apiClient.post).mockRejectedValueOnce(new ApiError('Rate limited', 429));
    await renderWithProviders(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'user@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
    await waitFor(() => expect(screen.getByText(/Too many attempts/)).toBeTruthy());
    expect(screen.queryByText(/If that email is registered/)).toBeNull();
  });

  it('hands reset links to the approved secure web reset flow', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ token: 'reset-token' } as never);
    await renderWithProviders(<ResetPasswordScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Continue to secure password reset' }),
    );
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://www.app.admiino.com/reset-password/reset-token',
    );
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('resends verification only after acceptance and starts the cooldown', async () => {
    jest.mocked(apiClient.post).mockResolvedValueOnce({ status: 'success' } as never);
    await renderWithProviders(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'user@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Resend verification email' }));
    await waitFor(() =>
      expect(
        screen.getByText(
          /If that account needs verification, a verification email has been requested/,
        ),
      ).toBeTruthy(),
    );
    expect(apiClient.post).toHaveBeenCalledWith('/auth/resend-verification', {
      email: 'user@example.com',
    });
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeDisabled();
  });

  it('inspects invitations before offering the secure web flow', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ token: 'invite-token' } as never);
    jest.mocked(apiClient.get).mockResolvedValueOnce({
      status: 'success',
      data: {
        invite: {
          workspaceName: 'Example Workspace',
          role: 'member',
          maskedEmail: 'us***@example.com',
          existingAccount: false,
        },
      },
    } as never);
    await renderWithProviders(<InvitationScreen />);
    await waitFor(() => expect(screen.getByText(/Example Workspace as member/)).toBeTruthy());
    await fireEvent.press(
      screen.getByRole('button', { name: 'Continue in secure invitation flow' }),
    );
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://www.app.admiino.com/signup-with-invite?token=invite-token',
    );
  });

  it('requires an authenticated session to accept an inspected invitation', async () => {
    const restore = jest.fn(async () => undefined);
    jest.mocked(useAuth).mockReturnValue({ status: 'authenticated', restore } as never);
    jest.mocked(useLocalSearchParams).mockReturnValue({ token: 'invite-token' } as never);
    jest.mocked(apiClient.get).mockResolvedValueOnce({
      status: 'success',
      data: {
        invite: {
          workspaceName: 'Example Workspace',
          role: 'member',
          maskedEmail: 'us***@example.com',
          existingAccount: true,
        },
      },
    } as never);
    jest.spyOn(sessionService, 'restoreSession').mockResolvedValueOnce('session-token');
    jest.mocked(apiClient.post).mockResolvedValueOnce({ status: 'success' } as never);

    await renderWithProviders(<InvitationScreen />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Accept invitation' })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Accept invitation' }));
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'Invitation accepted' })).toBeTruthy(),
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      '/invites/invite-token/accept',
      {},
      { token: 'session-token' },
    );
    expect(restore).toHaveBeenCalled();
    expect(screen.queryByText('session-token')).toBeNull();
  });

  it('uses the web activation flow with the secret in a URL fragment', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ token: 'activation-token' } as never);
    jest.mocked(apiClient.post).mockResolvedValueOnce({ status: 'success' } as never);
    await renderWithProviders(<ActivationScreen />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Continue secure activation' }),
    );
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://www.app.admiino.com/activate-account#token=activation-token',
    );
  });
});
