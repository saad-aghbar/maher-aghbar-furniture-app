import { useLocale } from './useLocale';

/** Convenience hook — same as `useLocale().t`. */
export function useTranslation() {
  const { t, locale, isRTL } = useLocale();
  return { t, locale, isRTL };
}
