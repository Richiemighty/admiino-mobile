import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import {
  AppButton,
  AppCard,
  AppScreen,
  AppText,
  InlineError,
  LoadingState,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import {
  inboxService,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPreference,
  type NotificationPreferencePatch,
  type NotificationPreferences,
} from './service';

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  assignments: 'Assignments',
  mentions_replies: 'Mentions and replies',
  status_review: 'Status and review changes',
  due_work: 'Due soon and overdue',
  project_team: 'Project and team updates',
  client_access: 'Client access updates',
  workspace_commercial: 'Workspace updates',
};

const CHANNELS: { key: NotificationChannel; label: string }[] = [
  { key: 'inAppEnabled', label: 'In-app' },
  { key: 'emailEnabled', label: 'Email' },
  { key: 'whatsAppEnabled', label: 'WhatsApp' },
];

type DirtyPreferences = Partial<
  Record<NotificationCategory, Partial<Record<NotificationChannel, boolean>>>
>;

function isDirty(dirty: DirtyPreferences): boolean {
  return Object.values(dirty).some((channels) => Boolean(channels && Object.keys(channels).length));
}

function preferenceError(error: unknown): string {
  if (error instanceof ApiNetworkError) return 'You appear to be offline. Reconnect and try again.';
  if (error instanceof ApiTimeoutError) return 'This request took too long. Please try again.';
  if (error instanceof ApiError && error.status === 403)
    return 'Notification settings are not available for this account.';
  if (error instanceof ApiError && error.status === 429)
    return 'Too many requests. Wait a moment, then try again.';
  return 'Notification settings could not be saved. Please try again.';
}

function emailNote(row: NotificationPreference): string | null {
  if (!row.eventDefaults?.some((entry) => entry.channel === 'emailEnabled')) return null;
  if (row.emailEnabled)
    return 'Email is enabled for all workspace updates, including join-request alerts.';
  if (row.explicit?.emailEnabled === false)
    return 'Email is off for workspace updates, including join-request alerts.';
  return 'Join-request alerts may be emailed by default; other workspace emails are off by default.';
}

export function NotificationSettingsScreen() {
  const { logout } = useAuth();
  const { colors } = useAppTheme();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [dirty, setDirty] = useState<DirtyPreferences>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const savingInProgress = useRef(false);

  const load = useCallback(
    (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      void inboxService
        .getPreferences(signal)
        .then((response) => {
          if (signal.aborted) return;
          setPreferences(response);
          setDirty({});
        })
        .catch(async (requestError: unknown) => {
          if (signal.aborted) return;
          if (requestError instanceof ApiError && requestError.status === 401) {
            try {
              await logout();
              router.replace('/sign-in');
            } catch {
              setError('Your session could not be cleared safely. Please try again.');
            }
            return;
          }
          setError(preferenceError(requestError));
        })
        .finally(() => {
          if (!signal.aborted) setLoading(false);
        });
    },
    [logout],
  );

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      request.current = controller;
      load(controller.signal);
      return () => {
        request.current?.abort();
        request.current = null;
      };
    }, [load]),
  );

  const retryLoad = () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    load(controller.signal);
  };

  const changePreference = (
    category: NotificationCategory,
    channel: NotificationChannel,
    value: boolean,
  ) => {
    setDirty((current) => ({
      ...current,
      [category]: { ...current[category], [channel]: value },
    }));
    setPreferences((current) =>
      current
        ? {
            ...current,
            preferences: current.preferences.map((row) =>
              row.category === category ? { ...row, [channel]: value } : row,
            ),
          }
        : current,
    );
  };

  const save = async () => {
    if (!isDirty(dirty) || savingInProgress.current) return;
    savingInProgress.current = true;
    const patches: NotificationPreferencePatch[] = [];
    for (const category of NOTIFICATION_CATEGORIES) {
      const changes = dirty[category];
      if (changes && Object.keys(changes).length) patches.push({ category, ...changes });
    }
    if (!patches.length) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await inboxService.updatePreferences(patches);
      setPreferences((current) => (current ? { ...current, preferences: saved } : current));
      setDirty({});
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        try {
          await logout();
          router.replace('/sign-in');
        } catch {
          setError('Your session could not be cleared safely. Please try again.');
        }
      } else {
        setError(preferenceError(requestError));
      }
    } finally {
      savingInProgress.current = false;
      setSaving(false);
    }
  };

  const back = () => {
    if (isDirty(dirty)) {
      Alert.alert(
        'Discard unsaved changes?',
        'Your notification preferences have not been saved.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              if (router.canGoBack()) router.back();
              else router.replace('/inbox');
            },
          },
        ],
      );
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/inbox');
  };

  if (loading && !preferences) {
    return (
      <AppScreen padding="md">
        <LoadingState label="Loading notification settings" />
      </AppScreen>
    );
  }

  if (error && !preferences) {
    return (
      <AppScreen padding="md">
        <View style={{ gap: themeTokens.spacing.md }}>
          <AppText accessibilityRole="header" variant="heading">
            Notification settings
          </AppText>
          <InlineError message={error} />
          <AppButton
            accessibilityLabel="Retry loading notification settings"
            onPress={retryLoad}
            variant="outline"
          >
            Try again
          </AppButton>
          <AppButton accessibilityLabel="Back to Inbox" onPress={back} variant="ghost">
            Back to Inbox
          </AppButton>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen padding="md">
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          gap: themeTokens.spacing.sm,
          paddingBottom: themeTokens.spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            accessibilityLabel="Back to Inbox"
            accessibilityRole="button"
            onPress={back}
            style={{
              width: themeTokens.touchTarget.minimum,
              height: themeTokens.touchTarget.minimum,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft color={colors.text} size={20} />
          </Pressable>
          <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
            Notification settings
          </AppText>
        </View>
        {error ? <InlineError message={error} /> : null}
        {preferences?.preferences.map((row) => {
          const note = emailNote(row);
          return (
            <AppCard key={row.category} padding="sm" style={{ gap: 4 }}>
              <AppText variant="label">{CATEGORY_LABELS[row.category]}</AppText>
              {CHANNELS.map(({ key, label }) => {
                const disabled =
                  key === 'whatsAppEnabled' &&
                  (!preferences.whatsApp.linked || !preferences.whatsApp.globallyEnabled);
                return (
                  <View
                    key={key}
                    style={{
                      minHeight: 48,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <AppText variant="caption">{label}</AppText>
                    <Switch
                      accessibilityLabel={`${CATEGORY_LABELS[row.category]} ${label}`}
                      disabled={disabled || saving}
                      onValueChange={(value) => changePreference(row.category, key, value)}
                      value={row[key]}
                      trackColor={{
                        false: colors.border,
                        true: colors.primaryAction,
                      }}
                    />
                  </View>
                );
              })}
              {note ? (
                <AppText tone="secondary" variant="caption">
                  {note}
                </AppText>
              ) : null}
            </AppCard>
          );
        })}
        <AppText tone="secondary" variant="caption">
          {!preferences?.whatsApp.linked
            ? 'WhatsApp preferences are saved, but this account has no linked WhatsApp number.'
            : !preferences.whatsApp.globallyEnabled
              ? 'WhatsApp is disabled in the connected account settings.'
              : 'WhatsApp delivery also follows the connected account settings.'}
        </AppText>
        <AppText tone="subtle" variant="caption">
          Push notifications are not available yet. In-app updates work without device push
          permissions.
        </AppText>
        <AppButton
          accessibilityLabel="Save notification settings"
          disabled={!isDirty(dirty)}
          loading={saving}
          onPress={() => void save()}
        >
          Save preferences
        </AppButton>
      </ScrollView>
    </AppScreen>
  );
}
