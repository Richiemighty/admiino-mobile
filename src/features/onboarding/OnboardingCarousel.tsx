import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText, InlineError } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { AnimatedEntrance } from './AnimatedEntrance';
import { onboardingSlides } from './content';
import { getMotionSettings, getSwipeDirection } from './motion';
import { OnboardingArtwork } from './OnboardingArtwork';
import { OnboardingProgress } from './OnboardingProgress';
import { onboardingRoutes } from './routes';
import { markOnboardingCompleted } from './storage';
import { useReducedMotion } from './useReducedMotion';

interface OnboardingCarouselProps {
  initialIndex?: number;
}

export function OnboardingCarousel({ initialIndex = 0 }: OnboardingCarouselProps) {
  const { width } = useWindowDimensions();
  const { colors, resolvedMode } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), onboardingSlides.length - 1),
  );
  const [transitioning, setTransitioning] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const isCompleting = useRef(false);
  const [translateX] = useState(() => new Animated.Value(0));
  const [contentOpacity] = useState(() => new Animated.Value(1));
  const motion = getMotionSettings(reduceMotion);
  const slide = onboardingSlides[activeIndex];
  const panelBackground =
    resolvedMode === 'dark' ? 'rgba(27, 25, 37, 0.94)' : 'rgba(249, 248, 253, 0.94)';

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      translateX.stopAnimation();
      contentOpacity.stopAnimation();
    };
  }, [contentOpacity, translateX]);

  const animateTo = useCallback(
    (nextIndex: number, direction: -1 | 1, startX = 0) => {
      if (transitioning || completing || nextIndex < 0 || nextIndex >= onboardingSlides.length) {
        return;
      }

      setTransitioning(true);
      setError(null);
      translateX.setValue(reduceMotion ? 0 : startX);

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: reduceMotion ? 0 : -direction * width,
          duration: motion.slideDuration,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: reduceMotion ? 0 : 0.2,
          duration: motion.slideDuration,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished || !isMounted.current) return;

        setActiveIndex(nextIndex);
        translateX.setValue(reduceMotion ? 0 : direction * width);
        contentOpacity.setValue(reduceMotion ? 0 : 0.2);

        Animated.parallel([
          Animated.timing(translateX, {
            toValue: 0,
            duration: motion.slideDuration,
            useNativeDriver: true,
          }),
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: motion.slideDuration,
            useNativeDriver: true,
          }),
        ]).start(({ finished: entered }) => {
          if (!isMounted.current) return;
          setTransitioning(false);
          if (!entered) {
            translateX.setValue(0);
            contentOpacity.setValue(1);
          }
        });
      });
    },
    [
      completing,
      contentOpacity,
      motion.slideDuration,
      reduceMotion,
      transitioning,
      translateX,
      width,
    ],
  );

  const panResponder = useMemo(() => {
    // Gesture callbacks read the mount ref only after this render completes.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        !transitioning &&
        !completing &&
        Math.abs(gesture.dx) > 12 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.15,
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_event, gesture) => {
        if (!reduceMotion && !transitioning && !completing) {
          translateX.setValue(gesture.dx);
        }
      },
      onPanResponderRelease: (_event, gesture) => {
        const direction = getSwipeDirection(
          gesture.dx,
          gesture.dy,
          gesture.vx,
          activeIndex,
          onboardingSlides.length,
        );
        if (direction !== 0) {
          animateTo(activeIndex + direction, direction, gesture.dx);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            speed: 22,
            bounciness: 4,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          speed: 22,
          bounciness: 4,
        }).start();
      },
    });
  }, [activeIndex, animateTo, completing, reduceMotion, transitioning, translateX]);

  useEffect(() => {
    if (activeIndex > 0) {
      AccessibilityInfo.announceForAccessibility(
        `Step ${activeIndex + 1} of ${onboardingSlides.length}. ${slide.title}`,
      );
    }
  }, [activeIndex, slide.title]);

  const completeOnboarding = useCallback(async () => {
    if (isCompleting.current || transitioning) return;
    isCompleting.current = true;
    setCompleting(true);
    setError(null);
    try {
      await markOnboardingCompleted();
      if (isMounted.current) {
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: motion.slideDuration,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && isMounted.current) router.replace(onboardingRoutes.accountChoice);
        });
      }
    } catch {
      if (isMounted.current) {
        setError('We could not save your progress. Please try again.');
        isCompleting.current = false;
        setCompleting(false);
      }
    }
  }, [contentOpacity, motion.slideDuration, transitioning]);

  const handleBack = () => {
    if (activeIndex === 0) {
      router.replace(onboardingRoutes.welcome);
      return;
    }
    animateTo(activeIndex - 1, -1);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.slideLayer, { opacity: contentOpacity, transform: [{ translateX }] }]}
        testID="onboarding-swipe-surface"
      >
        <AnimatedEntrance delay={0} reduceMotion={reduceMotion} style={StyleSheet.absoluteFill}>
          <OnboardingArtwork
            accessibilityLabel={slide.imageAccessibilityLabel}
            scale={slide.artworkScale}
            source={slide.image}
          />
        </AnimatedEntrance>
        <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.screen}>
              <View style={styles.topControls}>
                <AppButton
                  accessibilityLabel={activeIndex === 0 ? 'Back to welcome' : 'Back'}
                  disabled={transitioning || completing}
                  onPress={handleBack}
                  style={[styles.topButton, { backgroundColor: colors.surface }]}
                  variant="ghost"
                >
                  Back
                </AppButton>
                <AppButton
                  accessibilityLabel="Skip onboarding"
                  disabled={transitioning || completing}
                  onPress={() => void completeOnboarding()}
                  style={[styles.topButton, { backgroundColor: colors.surface }]}
                  variant="ghost"
                >
                  Skip
                </AppButton>
              </View>

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
                <View key={activeIndex} style={styles.copy}>
                  <AnimatedEntrance delay={reduceMotion ? 0 : 55} reduceMotion={reduceMotion}>
                    <AppText
                      accessibilityLiveRegion="polite"
                      accessibilityRole="header"
                      style={styles.centeredText}
                      variant="title"
                    >
                      {slide.title}
                    </AppText>
                  </AnimatedEntrance>
                  <AnimatedEntrance delay={reduceMotion ? 0 : 115} reduceMotion={reduceMotion}>
                    <AppText style={styles.centeredText} tone="secondary">
                      {slide.body}
                    </AppText>
                  </AnimatedEntrance>
                </View>

                <View style={styles.footer}>
                  {error && <InlineError message={error} />}
                  <OnboardingProgress activeIndex={activeIndex} reduceMotion={reduceMotion} />
                  <AnimatedEntrance delay={reduceMotion ? 0 : 165} reduceMotion={reduceMotion}>
                    <AppButton
                      accessibilityLabel={
                        activeIndex === onboardingSlides.length - 1
                          ? 'Continue to account choice'
                          : 'Next'
                      }
                      disabled={transitioning || completing}
                      loading={completing}
                      onPress={() => {
                        if (activeIndex === onboardingSlides.length - 1) {
                          void completeOnboarding();
                        } else {
                          animateTo(activeIndex + 1, 1);
                        }
                      }}
                    >
                      {activeIndex === onboardingSlides.length - 1 ? 'Continue' : 'Next'}
                    </AppButton>
                  </AnimatedEntrance>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
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
  scrollView: {
    flex: 1,
  },
  slideLayer: {
    flex: 1,
    position: 'relative',
  },
  scrollContent: {
    flexGrow: 1,
  },
  screen: {
    flexGrow: 1,
    minHeight: '100%',
    justifyContent: 'space-between',
    gap: themeTokens.spacing.md,
    paddingHorizontal: themeTokens.spacing.md,
    paddingVertical: themeTokens.spacing.sm,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topButton: {
    minWidth: 76,
    borderRadius: themeTokens.radius.pill,
    ...themeTokens.elevation.card,
  },
  flexSpace: {
    flexGrow: 1,
    minHeight: themeTokens.spacing.xl,
  },
  panel: {
    gap: themeTokens.spacing.sm,
    padding: themeTokens.spacing.lg,
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
  footer: {
    gap: themeTokens.spacing.sm,
  },
});
