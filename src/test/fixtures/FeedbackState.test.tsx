import { describe, expect, it } from '@jest/globals';
import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '../render';
import { FeedbackState } from './FeedbackState';

describe('feedback state fixture', () => {
  it('exposes an accessible loading label', async () => {
    await renderWithProviders(<FeedbackState state="loading" />);

    expect(screen.getByLabelText('Loading tasks')).toBeTruthy();
  });

  it('announces a controlled error state', async () => {
    await renderWithProviders(<FeedbackState state="error" message="Could not load tasks." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load tasks.');
  });
});
