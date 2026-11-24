import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import { type AppThemeColors, type ThemeColorMode, themeTokens } from './tokens';

export type ThemeMode = ThemeColorMode | 'system';

export interface AppThemeContextValue {
  mode: ThemeMode;
  resolvedMode: ThemeColorMode;
  colors: AppThemeColors;
  preferenceLoadError: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
}

interface ThemeProviderProps extends PropsWithChildren {
  initialMode?: ThemeMode;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);
const THEME_MODE_KEY = 'admiino.mobile.theme-mode';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children, initialMode }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode ?? 'system');
  const [preferenceLoadError, setPreferenceLoadError] = useState(false);
  const modeRef = useRef<ThemeMode>(initialMode ?? 'system');
  const modeRequest = useRef(0);
  const systemMode = useColorScheme();
  const resolvedMode: ThemeColorMode =
    mode === 'system' ? (systemMode === 'dark' ? 'dark' : 'light') : mode;
  const setMode = useCallback(async (nextMode: ThemeMode) => {
    const requestId = ++modeRequest.current;
    const previousMode = modeRef.current;
    modeRef.current = nextMode;
    setModeState(nextMode);
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, nextMode);
      if (modeRequest.current === requestId) setPreferenceLoadError(false);
    } catch (error) {
      if (modeRequest.current === requestId) {
        modeRef.current = previousMode;
        setModeState(previousMode);
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    if (initialMode !== undefined) return undefined;
    let active = true;
    const requestId = modeRequest.current;
    void AsyncStorage.getItem(THEME_MODE_KEY)
      .then((storedMode) => {
        if (!active || requestId !== modeRequest.current) return;
        if (storedMode === null) return;
        if (!isThemeMode(storedMode)) {
          setPreferenceLoadError(true);
          return;
        }
        modeRef.current = storedMode;
        setModeState(storedMode);
      })
      .catch(() => {
        if (active && requestId === modeRequest.current) setPreferenceLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [initialMode]);

  const value = useMemo(
    () => ({
      mode,
      resolvedMode,
      colors: themeTokens.colors[resolvedMode],
      preferenceLoadError,
      setMode,
    }),
    [mode, preferenceLoadError, resolvedMode, setMode],
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
