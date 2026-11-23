import { useLocalSearchParams } from 'expo-router';

import { resolveInitialSlideIndex } from '../../src/features/onboarding/motion';
import { OnboardingCarousel } from '../../src/features/onboarding/OnboardingCarousel';

export default function SlidesRoute() {
  const { step } = useLocalSearchParams<{ step?: string }>();
  const initialIndex = resolveInitialSlideIndex(step, __DEV__);

  return <OnboardingCarousel initialIndex={initialIndex} />;
}
