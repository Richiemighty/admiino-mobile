import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText, Logo } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { AnimatedEntrance } from '../onboarding/AnimatedEntrance';
import { useReducedMotion } from '../onboarding/useReducedMotion';

interface AuthScreenProps extends PropsWithChildren {
  title: string;
  description: string;
  backLabel?: string;
  onBack?: () => void;
  footer?: ReactNode;
}

export function AuthScreen({
  children,
  title,
  description,
  backLabel,
  onBack,
  footer,
}: AuthScreenProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();

  return (
    <SafeAreaView
      edges={['top', 'right', 'bottom', 'left']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoider}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {backLabel && onBack && (
            <AppButton
              accessibilityLabel={backLabel}
              onPress={onBack}
              style={styles.backButton}
              variant="ghost"
            >
              {backLabel}
            </AppButton>
          )}
          <View style={styles.content}>
            <AnimatedEntrance delay={reduceMotion ? 0 : 20} reduceMotion={reduceMotion}>
              <View style={styles.logo}>
                <Logo size={112} />
              </View>
            </AnimatedEntrance>
            <AnimatedEntrance delay={reduceMotion ? 0 : 70} reduceMotion={reduceMotion}>
              <View style={styles.header}>
                <AppText accessibilityRole="header" style={styles.heading} variant="title">
                  {title}
                </AppText>
                <AppText style={styles.description} tone="secondary">
                  {description}
                </AppText>
              </View>
            </AnimatedEntrance>
            <AnimatedEntrance delay={reduceMotion ? 0 : 120} reduceMotion={reduceMotion}>
              <View style={styles.form}>{children}</View>
            </AnimatedEntrance>
            {footer && (
              <AnimatedEntrance delay={reduceMotion ? 0 : 170} reduceMotion={reduceMotion}>
                {footer}
              </AnimatedEntrance>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboardAvoider: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: themeTokens.spacing.lg,
    paddingVertical: themeTokens.spacing.md,
  },
  backButton: {
    alignSelf: 'flex-start',
    minWidth: 88,
    paddingHorizontal: themeTokens.spacing.sm,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: themeTokens.spacing.lg,
  },
  logo: { alignItems: 'center' },
  header: { alignItems: 'center', gap: themeTokens.spacing.sm },
  heading: { textAlign: 'center' },
  description: { textAlign: 'center', maxWidth: 360 },
  form: { width: '100%', gap: themeTokens.spacing.md },
});
