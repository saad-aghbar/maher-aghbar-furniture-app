/** Screens that already paint an in-page error can opt out of the global toast. */
export function shouldSkipQueryErrorToast(meta: unknown): boolean {
  return Boolean(
    meta &&
      typeof meta === 'object' &&
      'skipErrorToast' in meta &&
      (meta as { skipErrorToast?: boolean }).skipErrorToast,
  );
}
