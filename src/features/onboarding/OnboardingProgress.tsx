import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { getMotionSettings } from './motion';

interface OnboardingProgressProps {
  activeIndex: number;
  reduceMotion: boolean;
}

export function OnboardingProgress({ activeIndex, reduceMotion }: OnboardingProgressProps) {
  const { colors } = useAppTheme();
  const [segments] = useState(() => Array.from({ length: 3 }, () => new Animated.Value(0)));
  const motion = getMotionSettings(reduceMotion);

  useEffect(() => {
    const animation = Animated.parallel(
      segments.map((segment, index) =>
        Animated.timing(segment, {
          toValue: index === activeIndex ? 1 : 0,
          duration: motion.slideDuration,
          useNativeDriver: true,
        }),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [activeIndex, motion.slideDuration, segments]);

  return (
    <View
      accessibilityLabel={`Onboarding progress, step ${activeIndex + 1} of 3`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: 3, now: activeIndex + 1, text: `${activeIndex + 1} of 3` }}
      accessible
      style={styles.container}
      testID="onboarding-progress"
    >
      {segments.map((segment, index) => (
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          key={index}
          style={[
            styles.segment,
            {
              backgroundColor: index === activeIndex ? colors.primaryAction : colors.border,
              opacity: segment.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
              transform: [
                { scaleX: segment.interpolate({ inputRange: [0, 1], outputRange: [0.36, 1] }) },
              ],
            },
          ]}
          testID="onboarding-progress-segment"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: themeTokens.touchTarget.ios,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: themeTokens.spacing.xs,
  },
  segment: {
    width: 24,
    height: 8,
    borderRadius: themeTokens.radius.pill,
  },
});
