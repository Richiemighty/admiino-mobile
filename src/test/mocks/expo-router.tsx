import { jest } from '@jest/globals';
import { type PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { View } from 'react-native';

const RouteContainer = ({ children }: PropsWithChildren) => <>{children}</>;

export const Stack = Object.assign(RouteContainer, { Screen: () => null });
export const Tabs = Object.assign(RouteContainer, {
  Screen: ({ name }: { name: string }) => <View testID={`tab-screen-${name}`} />,
});
export const Slot = RouteContainer;
export const Link = RouteContainer;
export const Redirect = jest.fn(() => null);
export const router = {
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  push: jest.fn(),
  replace: jest.fn(),
};
export const useRouter = () => router;
export const useFocusEffect = (callback: () => void | (() => void)) => {
  useEffect(callback, [callback]);
};
export const useLocalSearchParams = jest.fn(() => ({}));
export const useGlobalSearchParams = () => ({});
export const usePathname = () => '/';
export const useSegments = () => [];
