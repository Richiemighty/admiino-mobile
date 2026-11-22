import { afterEach, describe, expect, it } from '@jest/globals';
import { cleanup } from '@testing-library/react-native';

import Index from '../../../app/index';
import { renderWithProviders } from '../render';

afterEach(() => {
  cleanup();
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_APP_ENV = 'development';
  process.env.EXPO_PUBLIC_API_REQUIRED = 'false';
});

describe('starter application', () => {
  it('renders the setup verification screen', async () => {
    const { getByRole, getByText } = await renderWithProviders(<Index />);

    expect(getByText('Admiino Mobile')).toBeTruthy();
    expect(getByText('Application setup completed successfully.')).toBeTruthy();
    expect(getByRole('link', { name: 'Open design system gallery' })).toBeTruthy();
  });

  it('shows the temporary development environment indicator', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'development';

    const { getByText } = await renderWithProviders(<Index />);

    expect(getByText('Development')).toBeTruthy();
  });
});
