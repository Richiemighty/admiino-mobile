import { router } from 'expo-router';
import { ArrowLeft, ExternalLink, Info } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import {
  AppButton,
  AppCard,
  AppScreen,
  AppText,
  IconButton,
  InlineError,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';

const SUPPORT_EMAIL = 'contact@admiino.com';

export function DeleteAccountScreen() {
  const { colors } = useAppTheme();
  const [error, setError] = useState<string | null>(null);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  const contactSupport = async () => {
    setError(null);
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20guidance`);
    } catch {
      setError('Email could not be opened on this device.');
    }
  };

  return (
    <AppScreen scrollable padding="md">
      <View
        style={{
          width: '100%',
          maxWidth: 680,
          alignSelf: 'center',
          gap: themeTokens.spacing.md,
        }}
      >
        <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton
            accessibilityLabel="Back to Settings"
            icon={<ArrowLeft color={colors.text} size={22} />}
            onPress={back}
          />
          <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
            Delete Account
          </AppText>
        </View>

        <AppCard padding="md" style={{ gap: themeTokens.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
            <Info color={colors.semantic.warning.foreground} size={22} />
            <AppText tone="warning" variant="label">
              Account deletion is unavailable
            </AppText>
          </View>
          <AppText>
            Admiino does not currently provide a self-service account deletion or deletion-request
            process in this app. No deletion request has been submitted, and your account has not
            been changed.
          </AppText>
          <AppText tone="secondary">
            Ownership transfer, workspace data and retention rules are not confirmed, so this app
            cannot safely explain deletion consequences or promise that workspace data would be
            removed.
          </AppText>
        </AppCard>

        {error ? <InlineError message={error} /> : null}
        <AppButton
          accessibilityLabel="Contact Support for account deletion guidance"
          icon={<ExternalLink color={colors.onPrimary} size={18} />}
          onPress={() => void contactSupport()}
        >
          Contact Support for Guidance
        </AppButton>
        <AppText tone="secondary" variant="caption">
          This opens an email to {SUPPORT_EMAIL}; it does not submit a deletion request.
        </AppText>
      </View>
    </AppScreen>
  );
}
