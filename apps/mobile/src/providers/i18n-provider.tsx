import {
  defaultLocale,
  getDirection,
  getMessages,
  isValidLocale,
  type Messages,
} from '@maher/i18n';
import type { Locale } from '@maher/types';
import * as Localization from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { I18nManager } from 'react-native';

type I18nContextValue = {
  locale: Locale;
  direction: 'ltr' | 'rtl';
  t: (key: string, fallback?: string) => string;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLocale(): Locale {
  const code = Localization.getLocales()[0]?.languageCode ?? defaultLocale;
  return isValidLocale(code) ? (code as Locale) : defaultLocale;
}

function flattenDot(messages: Messages): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      out[path] = node;
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        walk(value, path ? `${path}.${key}` : key);
      }
    }
  };
  walk(messages, '');
  return out;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);
  const flat = useMemo(() => flattenDot(getMessages(locale)), [locale]);
  const direction = getDirection(locale);

  const setLocale = useCallback((next: Locale) => {
    const rtl = getDirection(next) === 'rtl';
    if (I18nManager.isRTL !== rtl) {
      I18nManager.allowRTL(rtl);
      I18nManager.forceRTL(rtl);
    }
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => flat[key] ?? fallback ?? key,
    [flat],
  );

  const value = useMemo(
    () => ({ locale, direction, t, setLocale }),
    [locale, direction, t, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
