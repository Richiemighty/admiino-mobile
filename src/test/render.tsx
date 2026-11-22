import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement } from 'react';

export async function renderWithProviders(element: ReactElement, options?: RenderOptions) {
  return await render(element, options);
}
