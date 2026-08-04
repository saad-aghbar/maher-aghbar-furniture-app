'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  animateThemeChange,
  applyTheme,
  getAppliedTheme,
  getStoredTheme,
  getSystemTheme,
  persistTheme,
  type ThemeMode,
} from './theme';

export interface ThemeContextValue {
  /** Stored preference (`light` | `dark`). */
  theme: ThemeMode;
  /** Currently applied theme (synced from DOM after mount). */
  resolvedTheme: ThemeMode;
  /** False until client has synced with DOM/localStorage. */
  ready: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Always start as light on server + first client render so hydration matches.
  // Real value is synced from the FOUC `data-theme` attr in useLayoutEffect.
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const initial = getAppliedTheme();
    setThemeState(initial);
    applyTheme(initial);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getStoredTheme() != null) return;
      const next = getSystemTheme();
      setThemeState(next);
      animateThemeChange(next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [ready]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    persistTheme(next);
    animateThemeChange(next);
  }, []);

  const toggleTheme = useCallback(() => {
    // Read from DOM so a stale React state after refresh cannot invert the click.
    const current = getAppliedTheme();
    const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    persistTheme(next);
    animateThemeChange(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme: theme,
      ready,
      setTheme,
      toggleTheme,
    }),
    [theme, ready, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
