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
import { LocaleDirContext } from '@react-navigation/native';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  defaultLocale,
  getDirection,
  isValidLocale,
  locales,
} from '@maher/i18n';
import type { Direction, Locale } from '@maher/types';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from './format';
import { translate } from './translate';

export const LOCALE_STORAGE_KEY = 'maher.locale';

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export type LocaleContextValue = {
  locale: Locale;
  direction: Direction;
  isRTL: boolean;
  setLocale: (locale: Locale) => Promise<void>;
  t: TranslateFn;
  formatDate: (value: Date | string | number) => string;
  formatDateTime: (value: Date | string | number) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

let activeLocale: Locale = defaultLocale;

export function getActiveLocale(): Locale {
  return activeLocale;
}

async function applyNativeRtl(isRTL: boolean) {
  I18nManager.allowRTL(isRTL);
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.forceRTL(isRTL);
    // Native root layout flip may require an app reload after the first RTL↔LTR switch.
    // In-app textAlign / writingDirection / row direction update immediately without reload.
  }
}

export function LocaleProvider({
  children,
  initialLocale = defaultLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
        if (!cancelled && stored && isValidLocale(stored)) {
          setLocaleState(stored);
          activeLocale = stored;
          await applyNativeRtl(getDirection(stored) === 'rtl');
        } else {
          await applyNativeRtl(getDirection(initialLocale) === 'rtl');
        }
      } catch {
        await applyNativeRtl(getDirection(initialLocale) === 'rtl');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialLocale]);

  const setLocale = useCallback(async (next: Locale) => {
    if (!locales.includes(next)) return;
    setLocaleState(next);
    activeLocale = next;
    await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, next);
    await applyNativeRtl(getDirection(next) === 'rtl');
  }, []);

  const direction = getDirection(locale);
  const isRTL = direction === 'rtl';

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      direction,
      isRTL,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      formatDate: (v) => formatDate(locale, v),
      formatDateTime: (v) => formatDateTime(locale, v),
      formatNumber: (v, opts) => formatNumber(locale, v, opts),
      formatCurrency: (v) => formatCurrency(locale, v),
    }),
    [locale, direction, isRTL, setLocale],
  );

  // Override Expo Router / NavigationContainer LocaleDirContext, which defaults
  // to I18nManager at startup and does not track in-app language switches.
  // Native stack reads this for iOS swipe-back edge (must match mirrored back arrow).
  return createElement(
    LocaleContext.Provider,
    { value },
    createElement(LocaleDirContext.Provider, { value: direction }, children),
  );
}

export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}
