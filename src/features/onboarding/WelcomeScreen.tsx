import { router } from 'expo-router';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppButton, AppScreen, AppText, Logo } from '../../components/ui';
import { themeTokens } from '../../theme/tokens';
import { AnimatedEntrance } from './AnimatedEntrance';
import { welcomeContent } from './content';
import { onboardingRoutes } from './routes';
import { useReducedMotion } from './useReducedMotion';

export function WelcomeScreen() {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const imageHeight = Math.min(height * 0.4, width * 0.92);

  return (
    <AppScreen contentContainerStyle={styles.scrollContent} padding="md" scrollable>
      <View style={styles.screen}>
        <AnimatedEntrance delay={0} reduceMotion={reduceMotion}>
          <Logo size={96} />
        </AnimatedEntrance>

        <View style={styles.copy}>
          <AnimatedEntrance delay={90} reduceMotion={reduceMotion}>
            <AppText accessibilityRole="header" style={styles.centeredText} variant="title">
              {welcomeContent.title}
            </AppText>
          </AnimatedEntrance>
          <AnimatedEntrance delay={170} reduceMotion={reduceMotion}>
            <AppText style={styles.centeredText} tone="secondary">
              {welcomeContent.motto}
            </AppText>
          </AnimatedEntrance>
        </View>

        <AnimatedEntrance delay={70} reduceMotion={reduceMotion}>
          <Image
            accessible
            accessibilityLabel={welcomeContent.imageAccessibilityLabel}
            accessibilityRole="image"
            resizeMode="contain"
            source={welcomeContent.image}
            style={{ width: imageHeight * 0.75, height: imageHeight }}
          />
        </AnimatedEntrance>

        <View style={styles.footer}>
          <AnimatedEntrance delay={240} reduceMotion={reduceMotion}>
            <AppButton
              accessibilityLabel="Get started"
              onPress={() => router.replace(onboardingRoutes.slides)}
            >
              Get started
            </AppButton>
          </AnimatedEntrance>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  screen: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: themeTokens.spacing.sm,
    paddingVertical: themeTokens.spacing.sm,
  },
  copy: {
    width: '100%',
    alignItems: 'center',
    gap: themeTokens.spacing.sm,
  },
  centeredText: {
    textAlign: 'center',
  },
  footer: {
    width: '100%',
    gap: themeTokens.spacing.xs,
  },
});
