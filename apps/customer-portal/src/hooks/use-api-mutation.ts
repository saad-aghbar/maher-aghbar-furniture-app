import { ApiClientError } from '@/lib/api-client';
import { detectUiLocale, translateApiError } from '@maher/i18n';

/** Localized API / client error text for alerts and banners. */
export function mutationErrorMessage(error: unknown, fallback?: string): string {
  const locale = detectUiLocale(
    typeof document !== 'undefined' ? document.documentElement.lang : undefined,
  );
  return translateApiError(locale, error, fallback);
}
