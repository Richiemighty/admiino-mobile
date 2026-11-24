import { beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import { AppText } from '../components/ui';
import { renderWithProviders } from '../test/render';
import { type ThemeMode, ThemeProvider, useAppTheme } from './ThemeProvider';
import { type AppThemeColors, taskPriorityTone, taskStatusTone, themeTokens } from './tokens';

function ThemeModeProbe() {
  const { mode, resolvedMode, colors } = useAppTheme();
  return (
    <>
      <AppText testID="theme-mode">
        {mode}:{resolvedMode}:{colors.background}
      </AppText>
    </>
  );
}

function ThemeSetterProbe({
  onReady,
}: {
  onReady: (setMode: (mode: ThemeMode) => Promise<void>) => void;
}) {
  const { setMode } = useAppTheme();
  useEffect(() => onReady(setMode), [onReady, setMode]);
  return <ThemeModeProbe />;
}

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function expectReadable(foreground: string, background: string) {
  expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
}

describe('theme tokens and provider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('supports system mode and resolves it to a supported appearance', async () => {
    await renderWithProviders(
      <ThemeProvider initialMode="system">
        <ThemeModeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme-mode')).toHaveTextContent(/system:/);
  });

  it('supports explicit light and dark settings', async () => {
    await renderWithProviders(
      <ThemeProvider initialMode="dark">
        <ThemeModeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-mode')).toHaveTextContent(/dark:dark:/);
  });

  it('persists a selected theme and restores it on the next provider mount', async () => {
    let setModeForTest: ((mode: ThemeMode) => Promise<void>) | undefined;
    const onReady = (setMode: (mode: ThemeMode) => Promise<void>) => {
      setModeForTest = setMode;
    };
    const firstView = await render(
      <ThemeProvider initialMode="system">
        <ThemeSetterProbe onReady={onReady} />
      </ThemeProvider>,
    );
    await act(async () => {
      await setModeForTest?.('dark');
    });
    expect(await AsyncStorage.getItem('admiino.mobile.theme-mode')).toBe('dark');
    expect(screen.getByTestId('theme-mode')).toHaveTextContent(/^dark:dark:/);

    firstView.unmount();
    await render(
      <ThemeProvider>
        <ThemeModeProbe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent(/^dark:dark:/));
  });

  it('uses one status and priority tone map including in_review', () => {
    expect(taskStatusTone.in_review).toBe('warning');
    expect(taskPriorityTone.urgent).toBe('danger');
    expect(Object.keys(taskStatusTone)).toEqual([
      'pending',
      'in_progress',
      'in_review',
      'completed',
      'delayed',
      'cancelled',
    ]);
  });

  it('keeps normal text and semantic foregrounds above WCAG AA contrast in both themes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const colors: AppThemeColors = themeTokens.colors[mode];
      expectReadable(colors.text, colors.background);
      expectReadable(colors.textMuted, colors.background);
      expectReadable(colors.textSubtle, colors.background);
      expectReadable(colors.link, colors.background);
      expectReadable(colors.onPrimary, colors.primaryAction);
      expectReadable(colors.link, colors.primarySurface);

      for (const tone of Object.values(colors.semantic)) {
        expectReadable(tone.foreground, tone.background);
      }
    }
  });

  it('keeps gold decorative rather than using it as body text', () => {
    const goldContrastOnWhite = contrastRatio(themeTokens.brand.decorativeGold, '#FFFFFF');
    expect(goldContrastOnWhite).toBeLessThan(4.5);
  });
});
