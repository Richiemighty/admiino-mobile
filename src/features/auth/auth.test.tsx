import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderWithProviders } from '../../test/render';
import { AccountChoiceScreen } from '../onboarding/AccountChoiceScreen';
import { CreateAccountScreen } from './CreateAccountScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { SignInScreen } from './SignInScreen';
import { validateEmail } from './validation';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(async () => ({ type: 'opened' })),
}));

describe('P06B authentication UI', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
    jest.mocked(router.replace).mockClear();
    jest.mocked(router.back).mockClear();
  });

  it('opens Sign In and Create Account from Account Choice', async () => {
    await renderWithProviders(<AccountChoiceScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    expect(router.push).toHaveBeenCalledWith('/sign-in');

    await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
    expect(router.push).toHaveBeenCalledWith('/create-account');
  });

  it('validates Sign In fields and preserves password visibility state', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByRole('header', { name: 'Welcome back' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Email address is required.')).toBeTruthy();
    expect(screen.getByText('Password is required.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Email address'), 'not-an-email');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Email address'), ' user@example.com ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'local-preview-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Show Password' }));
    expect(screen.getByLabelText('Password').props.value).toBe('local-preview-password');
    expect(screen.getByRole('button', { name: 'Hide Password' })).toBeTruthy();
  });

  it('does not create a session and protects Sign In from duplicate submits', async () => {
    await renderWithProviders(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'user@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'preview');

    const submit = screen.getByRole('button', { name: 'Sign in' });
    await fireEvent.press(submit);
    await fireEvent.press(submit);
    expect(global.fetch).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(
        screen.getByText('Live sign-in is awaiting backend integration. No account was accessed.'),
      ).toBeTruthy(),
    );
  });

  it('navigates between Sign In and Forgot Password', async () => {
    await renderWithProviders(<SignInScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Forgot password' }));
    expect(router.push).toHaveBeenCalledWith('/forgot-password');

    await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
    expect(router.push).toHaveBeenCalledWith('/create-account');
  });

  it('validates recovery email without falsely reporting that a reset was sent', async () => {
    await renderWithProviders(<ForgotPasswordScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
    expect(screen.getByText('Email address is required.')).toBeTruthy();
    expect(screen.queryByText(/reset email was sent/i)).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Email address'), 'invalid');
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Email address'), 'user@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
    expect(global.fetch).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/No reset email was sent/i)).toBeTruthy());
  });

  it('provides UI-only create-account browser hand-off navigation', async () => {
    await renderWithProviders(<CreateAccountScreen />);
    expect(screen.getByRole('header', { name: 'Get started with Admiino' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue to create account' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('uses the shared email validator', () => {
    expect(validateEmail('')).toBe('Email address is required.');
    expect(validateEmail('bad')).toBe('Enter a valid email address.');
    expect(validateEmail(' user@example.com ')).toBeNull();
  });
});
