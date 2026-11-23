import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '../../test/render';
import { AccountChoiceScreen } from './AccountChoiceScreen';
import { accountChoiceContent, onboardingSlides, welcomeContent } from './content';
import { getMotionSettings, getSwipeDirection } from './motion';
import { OnboardingCarousel } from './OnboardingCarousel';
import { onboardingRoutes } from './routes';
import { isOnboardingCompleted, markOnboardingCompleted } from './storage';
import { WelcomeScreen } from './WelcomeScreen';

const mockRouterReplace = jest.mocked(router.replace);
const mockFetch = jest.mocked(global.fetch);

jest.setTimeout(10000);

describe('Welcome screen', () => {
  beforeEach(() => {
    mockRouterReplace.mockClear();
  });

  it('shows the official logo, approved heading, motto, transparent mascot, and Get started action', async () => {
    await renderWithProviders(<WelcomeScreen />);

    expect(screen.getByRole('image', { name: 'Admiino logo' })).toBeTruthy();
    expect(screen.getByRole('header', { name: welcomeContent.title })).toBeTruthy();
    expect(screen.getByText(welcomeContent.motto)).toBeTruthy();
    expect(
      screen.getByRole('image', { name: welcomeContent.imageAccessibilityLabel }).props.resizeMode,
    ).toBe('contain');

    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    expect(router.replace).toHaveBeenCalledWith(onboardingRoutes.slides);
  });
});

describe('three-slide onboarding carousel', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockRouterReplace.mockClear();
    mockFetch.mockReset();
  });

  it.each(onboardingSlides.map((slide, index) => [slide.title, index, slide.image] as const))(
    'shows the %s slide with its mapped illustration',
    async (title, index, image) => {
      await renderWithProviders(<OnboardingCarousel initialIndex={index} />);

      expect(screen.getByRole('header', { name: title })).toBeTruthy();
      const artwork = screen.getByRole('image', {
        name: onboardingSlides[index].imageAccessibilityLabel,
      });
      expect(artwork.props.source).toEqual(image);
      expect(artwork.props.resizeMode).toBe('contain');
      expect(artwork.props.style).toEqual({
        width: `${onboardingSlides[index].artworkScale * 100}%`,
        height: `${onboardingSlides[index].artworkScale * 100}%`,
      });
      expect(StyleSheet.flatten(artwork.parent?.props.style)).toMatchObject({
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: '#F2EFFA',
        alignItems: 'center',
        justifyContent: 'center',
      });
    },
  );

  it('has exactly three progress positions and advances/backtracks with accessible controls', async () => {
    await renderWithProviders(<OnboardingCarousel />);

    const progress = screen.getByTestId('onboarding-progress');
    expect(progress.props.children).toHaveLength(3);
    expect(
      screen.getByRole('progressbar', {
        name: 'Onboarding progress, step 1 of 3',
      }),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'Work better together' })).toBeTruthy(),
    );
    expect(
      screen.getByRole('progressbar', { name: 'Onboarding progress, step 2 of 3' }),
    ).toBeTruthy();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Next' }).props.accessibilityState.disabled).toBe(
        false,
      ),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() =>
      expect(screen.getByRole('header', { name: 'Organise your work' })).toBeTruthy(),
    );
  });

  it('resolves horizontal swipes directionally, rejects vertical gestures, and honors slide bounds', () => {
    expect(getSwipeDirection(-80, 5, -0.2, 0, 3)).toBe(1);
    expect(getSwipeDirection(80, 5, 0.2, 1, 3)).toBe(-1);
    expect(getSwipeDirection(6, 90, 0, 0, 3)).toBe(0);
    expect(getSwipeDirection(80, 4, 0.2, 0, 3)).toBe(0);
    expect(getSwipeDirection(-80, 4, -0.2, 2, 3)).toBe(0);
  });

  it('persists Skip and routes to Account Choice without making a network request', async () => {
    await renderWithProviders(<OnboardingCarousel />);

    await fireEvent.press(screen.getByRole('button', { name: 'Skip onboarding' }));

    await waitFor(async () => {
      expect(await isOnboardingCompleted()).toBe(true);
      expect(router.replace).toHaveBeenCalledWith(onboardingRoutes.accountChoice);
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('persists Continue from slide three and routes to Account Choice', async () => {
    await renderWithProviders(<OnboardingCarousel initialIndex={2} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue to account choice' }));

    await waitFor(async () => {
      expect(await isOnboardingCompleted()).toBe(true);
      expect(router.replace).toHaveBeenCalledWith(onboardingRoutes.accountChoice);
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('account choice UI-only actions', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockRouterReplace.mockClear();
  });

  it('opens both authentication routes without authentication calls', async () => {
    await renderWithProviders(<AccountChoiceScreen />);
    const artwork = screen.getByRole('image', {
      name: accountChoiceContent.imageAccessibilityLabel,
    });
    expect(artwork.props.resizeMode).toBe('contain');
    expect(artwork.props.style).toEqual({
      width: `${accountChoiceContent.artworkScale * 100}%`,
      height: `${accountChoiceContent.artworkScale * 100}%`,
    });
    expect(screen.queryByText('Development')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open design system gallery' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
    expect(router.push).toHaveBeenCalledWith('/create-account');

    await fireEvent.press(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    expect(router.push).toHaveBeenCalledWith('/sign-in');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('provides a development-only replay action that clears the preference', async () => {
    await markOnboardingCompleted();
    await renderWithProviders(<AccountChoiceScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Replay onboarding' }));

    await waitFor(async () => {
      expect(await isOnboardingCompleted()).toBe(false);
      expect(router.replace).toHaveBeenCalledWith(onboardingRoutes.welcome);
    });
  });
});

describe('motion preferences', () => {
  it('uses short opacity-only settings when Reduce Motion is enabled', () => {
    expect(getMotionSettings(true)).toEqual({
      entranceDuration: 90,
      slideDuration: 100,
      entranceOffset: 0,
    });
    expect(getMotionSettings(false).entranceOffset).toBeGreaterThan(0);
  });
});
