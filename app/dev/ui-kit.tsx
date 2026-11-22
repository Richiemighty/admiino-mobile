import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import {
  AppButton,
  AppCard,
  AppInput,
  AppScreen,
  AppText,
  IconButton,
  InlineError,
  LoadingState,
  Logo,
} from '../../src/components/ui';
import { DevelopmentOnlyRoute } from '../../src/navigation/DevelopmentOnlyRoute';
import { ThemeProvider, useAppTheme } from '../../src/theme';
import {
  type TaskPriority,
  taskPriorityTone,
  type TaskStatus,
  taskStatusTone,
  type ThemeColorMode,
  themeTokens,
} from '../../src/theme/tokens';

function ThemePreview({ mode }: { mode: ThemeColorMode }) {
  return (
    <ThemeProvider initialMode={mode}>
      <ThemePreviewContent mode={mode} />
    </ThemeProvider>
  );
}

function ThemePreviewContent({ mode }: { mode: ThemeColorMode }) {
  const { colors } = useAppTheme();
  const [inputValue, setInputValue] = useState('');
  const [retryMessage, setRetryMessage] = useState('The sample request could not be completed.');

  return (
    <View style={[styles.themePanel, { backgroundColor: colors.background }]}>
      <AppText variant="heading">{mode === 'light' ? 'Light theme' : 'Dark theme'}</AppText>

      <AppCard>
        <AppText variant="label">Typography and feedback</AppText>
        <AppText variant="display">Display</AppText>
        <AppText variant="title">Title</AppText>
        <AppText variant="heading">Heading</AppText>
        <AppText>Body copy wraps and scales with system text settings.</AppText>
        <AppText variant="caption" tone="secondary">
          Caption and muted text
        </AppText>
        <LoadingState label="Loading sample data" />
      </AppCard>

      <AppCard>
        <AppText variant="label">Button variants and states</AppText>
        <View style={styles.buttonGrid}>
          <AppButton
            accessibilityLabel="Primary action"
            onPress={() => undefined}
            style={styles.gridButton}
            variant="primary"
          >
            Primary
          </AppButton>
          <AppButton
            accessibilityLabel="Secondary action"
            onPress={() => undefined}
            style={styles.gridButton}
            variant="secondary"
          >
            Secondary
          </AppButton>
          <AppButton
            accessibilityLabel="Outline action"
            onPress={() => undefined}
            style={styles.gridButton}
            variant="outline"
          >
            Outline
          </AppButton>
          <AppButton
            accessibilityLabel="Ghost action"
            onPress={() => undefined}
            style={styles.gridButton}
            variant="ghost"
          >
            Ghost
          </AppButton>
          <AppButton
            accessibilityLabel="Destructive action"
            onPress={() => undefined}
            style={styles.gridButton}
            variant="destructive"
          >
            Destructive
          </AppButton>
          <AppButton
            accessibilityLabel="Loading action"
            loading
            onPress={() => undefined}
            style={styles.gridButton}
          >
            Loading
          </AppButton>
          <AppButton
            accessibilityLabel="Disabled action"
            disabled
            onPress={() => undefined}
            style={styles.gridButton}
          >
            Disabled
          </AppButton>
        </View>
      </AppCard>

      <AppCard>
        <AppText variant="label">Input and validation</AppText>
        <AppInput
          accessibilityHint="Sample controlled field"
          error="This is an example validation message."
          label="Workspace name"
          onChangeText={setInputValue}
          placeholder="Enter a name"
          value={inputValue}
        />
        <AppInput
          label="Password example"
          onChangeText={() => undefined}
          secureTextEntry
          value=""
        />
        <AppInput disabled label="Disabled input" onChangeText={() => undefined} value="" />
      </AppCard>

      <AppCard accessibilityLabel="Pressable card example" onPress={() => undefined}>
        <AppText variant="label">Pressable card</AppText>
        <AppText tone="secondary">Cards support accessible press and disabled states.</AppText>
      </AppCard>

      <AppCard>
        <AppText variant="label">Error and loading states</AppText>
        <InlineError
          message={retryMessage}
          onRetry={() => setRetryMessage('Retry requested in this UI-only preview.')}
        />
        <View style={[styles.fullLoadingSample, { backgroundColor: colors.surfaceSubtle }]}>
          <LoadingState label="Full-screen loading example" variant="fullScreen" />
        </View>
      </AppCard>

      <AppCard>
        <AppText variant="label">Task status and priority colors</AppText>
        <View style={styles.chipRow}>
          {(Object.keys(taskStatusTone) as TaskStatus[]).map((status) => {
            const tone = colors.semantic[taskStatusTone[status]];
            return (
              <View key={status} style={[styles.chip, { backgroundColor: tone.background }]}>
                <AppText style={{ color: tone.foreground }} variant="caption">
                  {status.replace('_', ' ')}
                </AppText>
              </View>
            );
          })}
        </View>
        <View style={styles.chipRow}>
          {(Object.keys(taskPriorityTone) as TaskPriority[]).map((priority) => {
            const tone = colors.semantic[taskPriorityTone[priority]];
            return (
              <View key={priority} style={[styles.chip, { backgroundColor: tone.background }]}>
                <AppText style={{ color: tone.foreground }} variant="caption">
                  {priority}
                </AppText>
              </View>
            );
          })}
        </View>
      </AppCard>

      <AppCard>
        <AppText variant="label">Brand artwork</AppText>
        <View style={styles.logoRow}>
          <Logo size={96} />
          <Logo size={64} variant="monogram" />
        </View>
        <Image
          accessibilityLabel="Admiino sample mascot illustration"
          resizeMode="contain"
          source={require('../../assets/admiino/onboarding/mascot-professional-phone.png')}
          style={styles.mascot}
        />
      </AppCard>

      <AppCard>
        <AppText variant="label">Accessible icon button</AppText>
        <IconButton
          accessibilityLabel="Add sample item"
          icon={
            <SymbolView
              name={{ ios: 'plus', android: 'add', web: 'add' }}
              size={themeTokens.iconSize.lg}
              tintColor={colors.primaryAction}
            />
          }
          onPress={() => undefined}
        />
        <IconButton
          accessibilityLabel="Loading icon action"
          icon={null}
          loading
          onPress={() => undefined}
        />
        <IconButton
          accessibilityLabel="Disabled icon action"
          disabled
          icon={null}
          onPress={() => undefined}
        />
      </AppCard>
    </View>
  );
}

function UiKitGallery() {
  return (
    <AppScreen scrollable padding="md">
      <View style={styles.gallery}>
        <AppText accessibilityRole="header" variant="title">
          Admiino UI Kit
        </AppText>
        <AppText tone="secondary">
          Development preview only. These components are foundation examples, not product screens.
        </AppText>
        <ThemePreview mode="light" />
        <ThemePreview mode="dark" />
      </View>
    </AppScreen>
  );
}

export default function UiKitRoute() {
  return (
    <DevelopmentOnlyRoute enabled={__DEV__}>
      <UiKitGallery />
    </DevelopmentOnlyRoute>
  );
}

const styles = StyleSheet.create({
  gallery: {
    gap: themeTokens.spacing.md,
  },
  themePanel: {
    gap: themeTokens.spacing.md,
    padding: themeTokens.spacing.md,
    borderRadius: themeTokens.radius.lg,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: themeTokens.spacing.xs,
  },
  gridButton: {
    flexBasis: '46%',
    flexGrow: 1,
  },
  fullLoadingSample: {
    height: 120,
    borderRadius: themeTokens.radius.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: themeTokens.spacing.xs,
  },
  chip: {
    paddingHorizontal: themeTokens.spacing.xs,
    paddingVertical: themeTokens.spacing.xxs,
    borderRadius: themeTokens.radius.pill,
  },
  logoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: themeTokens.spacing.md,
  },
  mascot: {
    height: 160,
    width: 120,
    alignSelf: 'center',
  },
});
