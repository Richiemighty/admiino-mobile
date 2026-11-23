import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETED_KEY = 'admiino.onboarding.completed';

export async function isOnboardingCompleted(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)) === 'true';
}

export async function markOnboardingCompleted(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
}

export async function clearOnboardingCompleted(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
}
