import { describe, expect, it } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';

import { AppText } from '../components/ui';
import { renderWithProviders } from '../test/render';
import { ThemeProvider, useAppTheme } from './ThemeProvider';
import { type AppThemeColors, taskPriorityTone, taskStatusTone, themeTokens } from './tokens';

function ThemeModeProbe() {
  const { mode, resolvedMode, setMode, colors } = useAppTheme();
  return (
    <>
      <AppText testID="theme-mode">
        {mode}:{resolvedMode}:{colors.background}
      </AppText>
      <AppText testID="change-theme" onPress={() => setMode('dark')}>
        Change theme
      </AppText>
    </>
  );
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
  it('supports system mode and changing the resolved theme', async () => {
    await renderWithProviders(
      <ThemeProvider initialMode="system">
        <ThemeModeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme-mode')).toHaveTextContent(/system:/);

    await fireEvent.press(screen.getByTestId('change-theme'));
    expect(screen.getByTestId('theme-mode')).toHaveTextContent(/dark:dark:/);
  });

  it('supports explicit light and dark settings', async () => {
    await renderWithProviders(
      <ThemeProvider initialMode="dark">
        <ThemeModeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-mode')).toHaveTextContent(/dark:dark:/);
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
