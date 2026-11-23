import type { ImageSourcePropType } from 'react-native';

import organiseWork from '../../../assets/admiino/onboarding/image.png';
import workTogether from '../../../assets/admiino/onboarding/image2.png';
import trackProgress from '../../../assets/admiino/onboarding/image3.png';
import accountChoiceHero from '../../../assets/admiino/onboarding/p06a/account-choice-productivity-hero.png';
import welcomeMascot from '../../../assets/admiino/onboarding/p06a/welcome-mascot-transparent.png';

export interface OnboardingSlide {
  title: string;
  body: string;
  image: ImageSourcePropType;
  imageAccessibilityLabel: string;
  artworkScale: number;
}

export const welcomeContent = {
  title: 'Welcome to Admiino',
  motto: 'Bring your team, tasks and projects together in one place.',
  image: welcomeMascot,
  imageAccessibilityLabel: 'A person using the Admiino mobile app.',
} as const;

export const onboardingSlides: readonly OnboardingSlide[] = [
  {
    title: 'Organise your work',
    body: 'Keep your tasks, projects and deadlines organised, all in one place.',
    image: organiseWork,
    imageAccessibilityLabel:
      'A person organising tasks with a calendar, project board and progress tools.',
    artworkScale: 0.86,
  },
  {
    title: 'Work better together',
    body: 'Share updates, discuss tasks and keep everyone working towards the same goal.',
    image: workTogether,
    imageAccessibilityLabel: 'A team collaborating around shared tasks and project updates.',
    artworkScale: 0.86,
  },
  {
    title: 'Stay on top of everything',
    body: "See what's due, follow progress and know what needs your attention.",
    image: trackProgress,
    imageAccessibilityLabel: 'A person tracking tasks, due dates and project progress.',
    artworkScale: 0.86,
  },
] as const;

export const accountChoiceContent = {
  title: 'Your Admiino journey starts here',
  body: 'Create an account or sign in to work with your team.',
  image: accountChoiceHero,
  imageAccessibilityLabel: 'Admiino productivity illustration with an embedded wordmark.',
  artworkScale: 0.78,
} as const;
