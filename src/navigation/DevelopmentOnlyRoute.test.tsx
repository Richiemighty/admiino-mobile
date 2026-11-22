import { describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { Redirect } from 'expo-router';

import { AppText } from '../components/ui';
import { renderWithProviders } from '../test/render';
import { DevelopmentOnlyRoute } from './DevelopmentOnlyRoute';

describe('development-only route guard', () => {
  it('renders the gallery content in development', async () => {
    await renderWithProviders(
      <DevelopmentOnlyRoute enabled>
        <AppText>Development gallery</AppText>
      </DevelopmentOnlyRoute>,
    );

    expect(screen.getByText('Development gallery')).toBeTruthy();
  });

  it('redirects instead of rendering gallery content in production', async () => {
    await renderWithProviders(
      <DevelopmentOnlyRoute enabled={false}>
        <AppText>Development gallery</AppText>
      </DevelopmentOnlyRoute>,
    );

    expect(screen.queryByText('Development gallery')).toBeNull();
    expect(jest.mocked(Redirect)).toHaveBeenCalled();
    expect(jest.mocked(Redirect).mock.calls[0]?.[0]).toEqual({ href: '/' });
  });
});
