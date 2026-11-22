import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { type AppThemeColors, type ThemeColorMode, themeTokens } from './tokens';

export type ThemeMode = ThemeColorMode | 'system';

export interface AppThemeContextValue {
  mode: ThemeMode;
  resolvedMode: ThemeColorMode;
  colors: AppThemeColors;
  setMode: (mode: ThemeMode) => void;
}

interface ThemeProviderProps extends PropsWithChildren {
  initialMode?: ThemeMode;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function ThemeProvider({ children, initialMode = 'system' }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const systemMode = useColorScheme();
  const resolvedMode: ThemeColorMode =
    mode === 'system' ? (systemMode === 'dark' ? 'dark' : 'light') : mode;
  const value = useMemo(
    () => ({ mode, resolvedMode, colors: themeTokens.colors[resolvedMode], setMode }),
    [mode, resolvedMode],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider.');
  }
  return context;
}
