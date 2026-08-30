import { isApiError } from './errors';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

/** Persist / dehydrate internals — never show these in production UI. */
export function isTechnicalQueryError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  if (!message) return false;
  return (
    message.includes('dehydrated as pending') ||
    message.includes('was dehydrated') ||
    (message.includes('dehydrat') && message.includes('pending'))
  );
}

/** Codes that should surface as toasts from global handlers. */
export function shouldToastApiError(error: unknown): boolean {
  if (isTechnicalQueryError(error)) return false;
  if (!isApiError(error)) return true;
  if (error.code === 'UNAUTHORIZED' || error.status === 401) return false;
  if (error.isAborted) return false;
  return (
    error.isOffline ||
    error.code === 'FORBIDDEN' ||
    error.code === 'TOO_MANY_REQUESTS' ||
    error.status >= 500 ||
    error.code === 'INTERNAL_ERROR' ||
    error.code === 'OFFLINE'
  );
}
