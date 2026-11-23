import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText, InlineError } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { AnimatedEntrance } from './AnimatedEntrance';
import { accountChoiceContent } from './content';
import { OnboardingArtwork } from './OnboardingArtwork';
import { onboardingRoutes } from './routes';
import { clearOnboardingCompleted } from './storage';
import { useReducedMotion } from './useReducedMotion';

export function AccountChoiceScreen() {
  const { colors, resolvedMode } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [replayError, setReplayError] = useState<string | null>(null);
  const panelBackground =
    resolvedMode === 'dark' ? 'rgba(27, 25, 37, 0.94)' : 'rgba(249, 248, 253, 0.94)';

  const replayOnboarding = async () => {
    setReplayError(null);
    try {
      await clearOnboardingCompleted();
      router.replace(onboardingRoutes.welcome);
    } catch {
      setReplayError('We could not reset the onboarding preview. Please try again.');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AnimatedEntrance delay={0} reduceMotion={reduceMotion} style={StyleSheet.absoluteFill}>
        <OnboardingArtwork
          accessibilityLabel={accountChoiceContent.imageAccessibilityLabel}
          scale={accountChoiceContent.artworkScale}
          source={accountChoiceContent.image}
        />
      </AnimatedEntrance>
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.screen}>
            <View style={styles.flexSpace} />
            <View
              style={[
                styles.panel,
                {
                  backgroundColor: panelBackground,
                  borderColor:
                    resolvedMode === 'dark'
                      ? 'rgba(194, 168, 255, 0.32)'
                      : 'rgba(103, 36, 219, 0.18)',
                },
              ]}
            >
              <View style={styles.copy}>
                <AnimatedEntrance delay={reduceMotion ? 0 : 55} reduceMotion={reduceMotion}>
                  <AppText accessibilityRole="header" style={styles.centeredText} variant="title">
                    {accountChoiceContent.title}
                  </AppText>
                </AnimatedEntrance>
                <AnimatedEntrance delay={reduceMotion ? 0 : 115} reduceMotion={reduceMotion}>
                  <AppText style={styles.centeredText} tone="secondary">
                    {accountChoiceContent.body}
                  </AppText>
                </AnimatedEntrance>
              </View>

              <View style={styles.actions}>
                <AnimatedEntrance delay={reduceMotion ? 0 : 165} reduceMotion={reduceMotion}>
                  <AppButton
                    accessibilityLabel="Create an account"
                    onPress={() => router.push('/create-account')}
                  >
                    Create an account
                  </AppButton>
                </AnimatedEntrance>
                <AnimatedEntrance delay={reduceMotion ? 0 : 215} reduceMotion={reduceMotion}>
                  <AppButton
                    accessibilityLabel="Already have an account? Sign in"
                    onPress={() => router.push('/sign-in')}
                    variant="outline"
                  >
                    Already have an account? Sign in
                  </AppButton>
                </AnimatedEntrance>
                {replayError && <InlineError message={replayError} />}
                {__DEV__ && (
                  <AppButton
                    accessibilityLabel="Replay onboarding"
                    onPress={() => void replayOnboarding()}
                    variant="ghost"
                  >
                    Replay onboarding
                  </AppButton>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
  },
  screen: {
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: themeTokens.spacing.md,
  },
  flexSpace: {
    flexGrow: 1,
    minHeight: themeTokens.spacing.sm,
  },
  panel: {
    gap: themeTokens.spacing.sm,
    padding: themeTokens.spacing.md,
    borderWidth: 1,
    borderRadius: themeTokens.radius.xl,
    ...themeTokens.elevation.card,
  },
  copy: {
    width: '100%',
    alignItems: 'center',
    gap: themeTokens.spacing.sm,
  },
  centeredText: {
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: themeTokens.spacing.xs,
  },
});
