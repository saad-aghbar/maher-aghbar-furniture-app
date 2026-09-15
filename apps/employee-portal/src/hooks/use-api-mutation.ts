import { detectUiLocale, translateApiError } from '@maher/i18n';

export function mutationErrorMessage(error: unknown, fallback?: string): string {
  const locale = detectUiLocale(
    typeof document !== 'undefined' ? document.documentElement.lang : undefined,
  );
  return translateApiError(locale, error, fallback);
}
