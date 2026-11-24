import { router } from 'expo-router';
import { ArrowLeft, Check, Laptop, Moon, Sun } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppScreen, AppText, IconButton, InlineError } from '../../components/ui';
import { type ThemeMode, useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';

const OPTIONS: {
  mode: ThemeMode;
  label: string;
  detail: string;
  Icon: typeof Sun;
}[] = [
  {
    mode: 'system',
    label: 'System Default',
    detail: 'Follow your device appearance',
    Icon: Laptop,
  },
  { mode: 'light', label: 'Light', detail: 'Use the light appearance', Icon: Sun },
  { mode: 'dark', label: 'Dark', detail: 'Use the dark appearance', Icon: Moon },
];

export function AppearanceSettingsScreen() {
  const { colors, mode, preferenceLoadError, setMode } = useAppTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  const choose = async (nextMode: ThemeMode) => {
    if (saving || mode === nextMode) return;
    setSaving(true);
    setError(null);
    try {
      await setMode(nextMode);
    } catch {
      setError('The appearance could not be saved. Your previous setting was restored.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen padding="md">
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
            App Appearance
          </AppText>
        </View>
        <AppText tone="secondary">
          Choose how Admiino looks on this device. System Default follows your device setting.
        </AppText>
        {preferenceLoadError ? (
          <InlineError message="The saved appearance preference could not be restored. Choose an option to save a new preference." />
        ) : null}
        {error ? <InlineError message={error} /> : null}
        <View style={{ gap: themeTokens.spacing.sm }}>
          {OPTIONS.map(({ mode: option, label, detail, Icon }) => {
            const selected = mode === option;
            return (
              <Pressable
                accessibilityLabel={`${label} appearance`}
                accessibilityRole="button"
                accessibilityState={{ disabled: saving, selected }}
                disabled={saving}
                key={option}
                onPress={() => void choose(option)}
                style={{
                  minHeight: 64,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: themeTokens.spacing.md,
                  padding: themeTokens.spacing.md,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? colors.primaryAction : colors.border,
                  borderRadius: themeTokens.radius.md,
                  backgroundColor: colors.surface,
                  opacity: saving && !selected ? 0.6 : 1,
                }}
              >
                <Icon color={selected ? colors.primaryAction : colors.textMuted} size={22} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="label">{label}</AppText>
                  <AppText tone="secondary" variant="caption">
                    {detail}
                  </AppText>
                </View>
                {selected ? <Check color={colors.primaryAction} size={20} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </AppScreen>
  );
}
