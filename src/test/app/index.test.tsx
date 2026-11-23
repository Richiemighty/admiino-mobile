import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import Index from '../../../app/index';
import { onboardingRoutes } from '../../features/onboarding/routes';
import { isOnboardingCompleted, markOnboardingCompleted } from '../../features/onboarding/storage';
import { renderWithProviders } from '../render';

describe('application launch route', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.mocked(router.replace).mockClear();
    jest.mocked(global.fetch).mockReset();
  });

  it('routes a fresh installation to the P06A Welcome screen', async () => {
    await renderWithProviders(<Index />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(onboardingRoutes.welcome));
    expect(await isOnboardingCompleted()).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('restores the completion preference and routes return visits to Account Choice', async () => {
    await markOnboardingCompleted();
    await renderWithProviders(<Index />);

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(onboardingRoutes.accountChoice),
    );
    expect(await isOnboardingCompleted()).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows a retry action when local preference storage cannot be read', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage unavailable'));
    await renderWithProviders(<Index />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(onboardingRoutes.welcome));
  });
});
