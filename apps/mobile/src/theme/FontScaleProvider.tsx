import * as SecureStore from 'expo-secure-store';
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
import {
  FONT_SCALE_DEFAULT,
  FONT_SCALE_STORAGE_KEY,
  chromeSize,
  parseStoredFontScale,
  roundFontScale,
} from './fontScale';

export type FontScaleContextValue = {
  fontScale: number;
  /** `persist: false` while dragging; persist on gesture end. */
  setFontScale: (next: number, persist?: boolean) => void;
};

const FontScaleContext = createContext<FontScaleContextValue | null>(null);

const FALLBACK: FontScaleContextValue = {
  fontScale: FONT_SCALE_DEFAULT,
  setFontScale: () => {},
};

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [fontScale, setFontScaleState] = useState(FONT_SCALE_DEFAULT);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await SecureStore.getItemAsync(FONT_SCALE_STORAGE_KEY);
        if (!cancelled) setFontScaleState(parseStoredFontScale(stored));
      } catch {
        if (!cancelled) setFontScaleState(FONT_SCALE_DEFAULT);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setFontScale = useCallback((next: number, persist = true) => {
    const rounded = roundFontScale(next);
    setFontScaleState((prev) => (prev === rounded ? prev : rounded));
    if (persist) {
      void SecureStore.setItemAsync(FONT_SCALE_STORAGE_KEY, String(rounded));
    }
  }, []);

  const value = useMemo<FontScaleContextValue>(
    () => ({ fontScale, setFontScale }),
    [fontScale, setFontScale],
  );

  return createElement(FontScaleContext.Provider, { value }, children);
}

export function useFontScale(): FontScaleContextValue {
  return useContext(FontScaleContext) ?? FALLBACK;
}

export function useChromeSize(base: number): number {
  const { fontScale } = useFontScale();
  return chromeSize(base, fontScale);
}
