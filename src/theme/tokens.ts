import type { TextStyle, ViewStyle } from 'react-native';

export const brandTokens = {
  logoInk: '#1E149F',
  decorativeGold: '#C69B19',
  logoCanvas: '#FFFFFF',
  action: {
    light: '#6724DB',
    dark: '#8951EC',
  },
} as const;

const semanticColors = {
  neutral: { background: '#F0EEF5', foreground: '#494454' },
  success: { background: '#E7F5EB', foreground: '#175D32' },
  warning: { background: '#FFF1CC', foreground: '#6B4A00' },
  info: { background: '#E6F0FF', foreground: '#174A8B' },
  danger: { background: '#FCE8E8', foreground: '#8E2323' },
} as const;

export const taskStatusTone = {
  pending: 'neutral',
  in_progress: 'info',
  in_review: 'warning',
  completed: 'success',
  delayed: 'danger',
  cancelled: 'neutral',
} as const;

export const taskPriorityTone = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
} as const;

const typography = {
  display: { fontSize: 32, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
} satisfies Record<string, Pick<TextStyle, 'fontSize' | 'fontWeight'>>;

const colors = {
  light: {
    background: '#F9F8FD',
    surface: '#FFFFFF',
    surfaceSubtle: '#F2EFFA',
    text: '#211B35',
    textMuted: '#625D70',
    textSubtle: '#756F82',
    border: '#E1DDE9',
    focus: '#6724DB',
    link: '#5520B5',
    primaryAction: brandTokens.action.light,
    onPrimary: '#FFFFFF',
    primarySurface: '#EEE5FF',
    semantic: semanticColors,
  },
  dark: {
    background: '#111019',
    surface: '#1B1925',
    surfaceSubtle: '#252131',
    text: '#F6F2FF',
    textMuted: '#C2BBD0',
    textSubtle: '#B0A9BF',
    border: '#393447',
    focus: '#B99AFF',
    link: '#C2A8FF',
    primaryAction: brandTokens.action.dark,
    onPrimary: '#FFFFFF',
    primarySurface: '#30234A',
    semantic: {
      neutral: { background: '#302C39', foreground: '#D5CEE1' },
      success: { background: '#163522', foreground: '#B6F1C6' },
      warning: { background: '#433516', foreground: '#FFE49A' },
      info: { background: '#1F344B', foreground: '#B8D7FF' },
      danger: { background: '#442222', foreground: '#FFB7B7' },
    },
  },
} as const;

export const themeTokens = {
  brand: brandTokens,
  colors,
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
  },
  typography,
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 999,
  },
  elevation: {
    flat: { elevation: 0, shadowOpacity: 0 },
    card: {
      elevation: 2,
      shadowColor: '#171229',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
    },
  } satisfies Record<string, ViewStyle>,
  iconSize: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  touchTarget: {
    ios: 44,
    android: 48,
    minimum: 48,
  },
  taskStatusTone,
  taskPriorityTone,
} as const;

export type AppThemeColors = (typeof colors)[keyof typeof colors];
export type ThemeColorMode = keyof typeof colors;
export type SpacingToken = keyof typeof themeTokens.spacing;
export type TypographyVariant = keyof typeof themeTokens.typography;
export type TaskStatus = keyof typeof taskStatusTone;
export type TaskPriority = keyof typeof taskPriorityTone;
export type SemanticTone = keyof typeof semanticColors;
