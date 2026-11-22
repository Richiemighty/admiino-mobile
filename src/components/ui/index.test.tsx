import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { Platform, StyleSheet, Text } from 'react-native';

import { renderWithProviders } from '../../test/render';
import {
  AppButton,
  AppCard,
  AppInput,
  AppScreen,
  AppText,
  IconButton,
  InlineError,
  LoadingState,
  Logo,
} from '.';

describe('shared UI components', () => {
  it('renders scalable, wrapping text with semantic theme colors', async () => {
    const { getByText, getByTestId } = await renderWithProviders(
      <>
        <AppText accessibilityRole="header" numberOfLines={2} tone="link" variant="heading">
          A long heading
        </AppText>
        <AppText maxFontSizeMultiplier={2} testID="large-text">
          Scalable text
        </AppText>
      </>,
    );

    expect(getByText('A long heading').props.allowFontScaling).toBe(true);
    expect(getByText('A long heading').props.numberOfLines).toBe(2);
    expect(getByTestId('large-text').props.allowFontScaling).toBe(true);
    expect(getByTestId('large-text').props.maxFontSizeMultiplier).toBe(2);
  });

  it('supports button variants and suppresses presses while disabled or loading', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <>
        <AppButton accessibilityLabel="Save changes" onPress={onPress}>
          Save
        </AppButton>
        <AppButton accessibilityLabel="Disabled action" disabled onPress={onPress}>
          Disabled
        </AppButton>
        <AppButton accessibilityLabel="Loading action" loading onPress={onPress}>
          Loading
        </AppButton>
      </>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Disabled action' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Loading action' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Loading action' }).props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true, disabled: true }),
    );
  });

  it('supports controlled input, visible errors, disabled state, and secure-entry toggling', async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(
      <>
        <AppInput
          error="Enter a valid email address."
          label="Email"
          onChangeText={onChangeText}
          value=""
        />
        <AppInput disabled label="Workspace" onChangeText={onChangeText} value="Read only" />
        <AppInput label="Password" onChangeText={onChangeText} secureTextEntry value="secret" />
      </>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(screen.getByLabelText('Workspace').props.editable).toBe(false);
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'person@example.test');
    await fireEvent.press(screen.getByLabelText('Show Password'));

    expect(onChangeText).toHaveBeenCalledWith('person@example.test');
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('Hide Password')).toBeTruthy();
  });

  it('provides safe-area, scroll, and keyboard-aware screen content', async () => {
    await renderWithProviders(
      <AppScreen keyboardAvoiding scrollable>
        <AppText>Safe screen content</AppText>
      </AppScreen>,
    );

    expect(screen.getByText('Safe screen content')).toBeTruthy();
  });

  it('makes pressable cards accessible and invokes their action', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <AppCard accessibilityLabel="Open task summary" onPress={onPress}>
        <AppText>Task summary</AppText>
      </AppCard>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Open task summary' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('announces errors and exposes an accessible retry action', async () => {
    const onRetry = jest.fn();
    await renderWithProviders(
      <InlineError
        message="Could not load tasks."
        onRetry={onRetry}
        retryLabel="Retry loading tasks"
      />,
    );

    expect(screen.getByLabelText('Could not load tasks.').props.accessibilityRole).toBe('alert');
    expect(screen.getByText('Could not load tasks.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry loading tasks' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('announces loading progress with the supplied label', async () => {
    await renderWithProviders(<LoadingState label="Loading workspace" />);

    expect(screen.getByLabelText('Loading workspace').props.accessibilityRole).toBe('progressbar');
  });

  it('renders the original wordmark accessibly without substituting generated art', async () => {
    await renderWithProviders(<Logo size={160} />);

    expect(screen.getByLabelText('Admiino logo').props.accessibilityRole).toBe('image');
  });

  it('gives icon buttons an accessible name, platform-sized target, and disabled/loading states', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <>
        <IconButton
          accessibilityLabel="Add task"
          icon={<Text>+</Text>}
          onPress={onPress}
          size={24}
        />
        <IconButton
          accessibilityLabel="Loading action"
          icon={<Text>+</Text>}
          loading
          onPress={onPress}
        />
        <IconButton
          accessibilityLabel="Disabled action"
          disabled
          icon={<Text>+</Text>}
          onPress={onPress}
        />
      </>,
    );

    const addButton = screen.getByRole('button', { name: 'Add task' });
    const touchTarget = StyleSheet.flatten(addButton.props.style);
    const minimumTarget = Platform.OS === 'ios' ? 44 : 48;

    expect(touchTarget.minHeight).toBeGreaterThanOrEqual(minimumTarget);
    await fireEvent.press(addButton);
    await fireEvent.press(screen.getByRole('button', { name: 'Loading action' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Disabled action' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
