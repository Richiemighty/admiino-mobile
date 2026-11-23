import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';

import { apiClient, ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { sessionService } from '../../auth/session';
import { AppButton, AppText, InlineError } from '../../components/ui';
import { AuthScreen } from './AuthScreen';

const APP_ORIGIN = 'https://www.app.admiino.com';

interface InvitationDetails {
  workspaceName: string;
  role: string;
  maskedEmail: string;
  existingAccount: boolean;
}

interface InvitationResponse {
  status: 'success';
  data: { invite: InvitationDetails };
}

export function InvitationScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { status, restore } = useAuth();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(
    token ? null : 'This invitation link is missing or invalid.',
  );
  const [loading, setLoading] = useState(Boolean(token));
  const [accepting, setAccepting] = useState(false);
  const [opening, setOpening] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (!token) return;

    let active = true;
    void apiClient
      .get<InvitationResponse>(`/invites/${encodeURIComponent(token)}`)
      .then((response) => {
        if (active) setInvitation(response.data.invite);
      })
      .catch((caught) => {
        if (!active) return;
        if (caught instanceof ApiError) {
          setError(caught.message || 'This invitation is invalid or expired.');
        } else if (caught instanceof ApiNetworkError || caught instanceof ApiTimeoutError) {
          setError(caught.message);
        } else {
          setError('The invitation could not be checked.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const accept = async () => {
    if (!token || lock.current || !invitation) return;
    lock.current = true;
    setAccepting(true);
    setError(null);
    try {
      const sessionToken = await sessionService.restoreSession();
      if (!sessionToken) {
        setError('Sign in with the invited account before accepting this invitation.');
        return;
      }
      await apiClient.post(
        `/invites/${encodeURIComponent(token)}/accept`,
        {},
        { token: sessionToken },
      );
      await restore();
      setAccepted(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        setError('Sign in with the email address that received this invitation.');
      } else if (caught instanceof ApiError) {
        setError(caught.message || 'This invitation could not be accepted.');
      } else if (caught instanceof ApiNetworkError || caught instanceof ApiTimeoutError) {
        setError(caught.message);
      } else {
        setError('This invitation could not be accepted. Please try again.');
      }
    } finally {
      setAccepting(false);
      lock.current = false;
    }
  };

  const continueInWeb = async () => {
    if (!token || opening) return;
    setOpening(true);
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(
        `${APP_ORIGIN}/signup-with-invite?token=${encodeURIComponent(token)}`,
      );
    } catch {
      setError('The secure invitation page could not be opened.');
    } finally {
      setOpening(false);
    }
  };

  if (accepted) {
    return (
      <AuthScreen description="The workspace invitation was accepted." title="Invitation accepted">
        <AppButton
          accessibilityLabel="Return to Admiino"
          onPress={() => router.replace('/authenticated')}
        >
          Return to Admiino
        </AppButton>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      backLabel="Back"
      description="Review this workspace invitation and continue with the invited account."
      onBack={() => router.replace('/sign-in')}
      title="Workspace invitation"
    >
      {error && <InlineError message={error} />}
      {loading && <AppText accessibilityRole="alert">Checking invitation…</AppText>}
      {invitation && (
        <AppText style={{ textAlign: 'center' }} tone="secondary">
          Invitation to {invitation.workspaceName} as {invitation.role}, sent to{' '}
          {invitation.maskedEmail}.
        </AppText>
      )}
      {!loading && invitation && status === 'authenticated' && (
        <AppButton
          accessibilityLabel="Accept invitation"
          disabled={accepting}
          loading={accepting}
          onPress={() => void accept()}
        >
          Accept invitation
        </AppButton>
      )}
      {!loading && invitation && status !== 'authenticated' && (
        <AppText style={{ textAlign: 'center' }} tone="secondary">
          Continue in the secure Admiino website to sign in or create an account for the invited
          email address.
        </AppText>
      )}
      {!loading && invitation && status !== 'authenticated' && (
        <AppButton
          accessibilityLabel="Continue in secure invitation flow"
          disabled={opening}
          loading={opening}
          onPress={() => void continueInWeb()}
        >
          Continue securely
        </AppButton>
      )}
      {!loading && !invitation && (
        <AppButton
          accessibilityLabel="Return to Sign In"
          onPress={() => router.replace('/sign-in')}
        >
          Return to Sign In
        </AppButton>
      )}
    </AuthScreen>
  );
}
