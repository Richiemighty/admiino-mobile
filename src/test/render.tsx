import { render, type RenderOptions, type RenderResult } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider } from '../theme';

export async function renderWithProviders(
  element: ReactElement,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const ExistingWrapper = options.wrapper;
  const Providers = ({ children }: PropsWithChildren) => (
    <ThemeProvider initialMode="light">
      <GestureHandlerRootView style={{ flex: 1 }}>
        {ExistingWrapper ? <ExistingWrapper>{children}</ExistingWrapper> : children}
      </GestureHandlerRootView>
    </ThemeProvider>
  );

  return await render(element, { ...options, wrapper: Providers });
}
