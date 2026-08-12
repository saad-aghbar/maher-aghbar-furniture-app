import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Appearance, View, type ColorSchemeName } from 'react-native';
import { createTheme } from './themes';
import { applyHighContrast, baseColorsForScheme } from './highContrast';
import type { ColorScheme, ThemeContextValue, ThemeMode } from './types';

export const THEME_STORAGE_KEY = 'maher.theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export { ThemeContext };

function resolveScheme(mode: ThemeMode, system: ColorSchemeName): ColorScheme {
  if (mode === 'light' || mode === 'dark') return mode;
  return system === 'dark' ? 'dark' : 'light';
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

async function readHighTextContrast(): Promise<boolean> {
  const api = AccessibilityInfo as typeof AccessibilityInfo & {
    isHighTextContrastEnabled?: () => Promise<boolean>;
  };
  if (typeof api.isHighTextContrastEnabled === 'function') {
    try {
      return await api.isHighTextContrastEnabled();
    } catch {
      return false;
    }
  }
  return false;
}

export function ThemeProvider({
  children,
  initialMode = 'system',
}: {
  children: ReactNode;
  initialMode?: ThemeMode;
}) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());
  const [highContrast, setHighContrast] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
        if (!cancelled && isThemeMode(stored)) {
          setModeState(stored);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    void readHighTextContrast().then((enabled) => {
      if (mounted) setHighContrast(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void SecureStore.setItemAsync(THEME_STORAGE_KEY, next);
  }, []);

  const colorScheme = resolveScheme(mode, systemScheme);
  const theme = useMemo(() => {
    const base = createTheme(colorScheme);
    if (!highContrast) return base;
    return {
      ...base,
      colors: applyHighContrast(baseColorsForScheme(colorScheme), colorScheme),
    };
  }, [colorScheme, highContrast]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colors: theme.colors,
      mode,
      colorScheme,
      setMode,
      highContrast,
    }),
    [theme, mode, colorScheme, setMode, highContrast],
  );

  void hydrated;

  return createElement(
    ThemeContext.Provider,
    { value },
    createElement(ThemeCanvas, null, children),
  );
}

/** Fills the native window so stack/tab transitions do not flash white in dark mode. */
export function ThemeCanvas({ children }: { children?: ReactNode }) {
  const { colors } = useThemeContext();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);
  return createElement(
    View,
    { style: { flex: 1, backgroundColor: colors.background } },
    children,
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
