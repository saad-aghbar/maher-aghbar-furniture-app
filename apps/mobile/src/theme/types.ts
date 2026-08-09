import type { TextStyle } from 'react-native';

export type ColorScheme = 'light' | 'dark';
export type ThemeMode = 'light' | 'dark' | 'system';

export type SpringConfig = {
  damping: number;
  stiffness: number;
  mass: number;
};

/** Semantic colors — access via `theme.colors`, never raw hex in screens. */
export type ThemeColors = {
  background: string;
  surface: string;
  surfaceSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  brand: string;
  brandHover: string;
  brandActive: string;
  brandSoft: string;
  onBrand: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  error: string;
  errorSoft: string;
  info: string;
  infoSoft: string;
  disabled: string;
  disabledFill: string;
  overlay: string;
};

export type FontWeightToken = 'regular' | 'medium' | 'semibold';

export type TextVariant = {
  fontSize: number;
  lineHeight: number;
  fontWeight: NonNullable<TextStyle['fontWeight']>;
  letterSpacing?: number;
};

export type TypographyVariantName =
  | 'display'
  | 'largeTitle'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodySecondary'
  | 'caption'
  | 'label';

export type ThemeTypography = {
  weights: Record<FontWeightToken, NonNullable<TextStyle['fontWeight']>>;
  variants: Record<TypographyVariantName, TextVariant>;
};

export type ThemeSpacing = {
  none: number;
  '2xs': number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
  '3xl': number;
  '4xl': number;
  '5xl': number;
  '6xl': number;
};

export type ThemeRadius = {
  none: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
};

export type ElevationStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

export type ThemeElevation = {
  none: ElevationStyle;
  /** Subtle lift for chips / compact tiles */
  rest: ElevationStyle;
  /** Soft board shadow for list/detail cards */
  card: ElevationStyle;
  /** Floating chrome — sheets, tab bars, elevated controls */
  raised: ElevationStyle;
};

export type ThemeMotion = {
  duration: {
    fast: number;
    normal: number;
    slow: number;
  };
  easing: {
    /** cubic-bezier as [x1, y1, x2, y2] for Reanimated / Animated */
    standard: readonly [number, number, number, number];
    emphasized: readonly [number, number, number, number];
  };
  spring: {
    gentle: SpringConfig;
    snappy: SpringConfig;
    bouncy: SpringConfig;
  };
};

export type ThemeSizes = {
  icon: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  touch: {
    min: number;
  };
};

export type Theme = {
  colorScheme: ColorScheme;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  elevation: ThemeElevation;
  motion: ThemeMotion;
  sizes: ThemeSizes;
};

export type ThemeContextValue = {
  theme: Theme;
  colors: ThemeColors;
  mode: ThemeMode;
  colorScheme: ColorScheme;
  setMode: (mode: ThemeMode) => void;
  highContrast?: boolean;
};
