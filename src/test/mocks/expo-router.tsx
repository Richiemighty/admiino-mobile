import { jest } from '@jest/globals';
import { type PropsWithChildren } from 'react';

const RouteContainer = ({ children }: PropsWithChildren) => <>{children}</>;

export const Stack = Object.assign(RouteContainer, { Screen: () => null });
export const Tabs = Object.assign(RouteContainer, { Screen: () => null });
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
export const useLocalSearchParams = () => ({});
export const useGlobalSearchParams = () => ({});
export const usePathname = () => '/';
export const useSegments = () => [];
