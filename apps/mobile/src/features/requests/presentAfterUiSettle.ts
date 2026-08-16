import { InteractionManager, Keyboard, Platform } from 'react-native';

/**
 * Wait until React Native finishes animations / Modal teardown, then run `fn`.
 * Required before ImagePicker / DocumentPicker / nested Modals on iOS — otherwise
 * the system sheet flash-opens and cancels immediately (looks like “upload broken”).
 */
export function presentAfterUiSettle<T>(fn: () => Promise<T>, settleMs = 120): Promise<T> {
  Keyboard.dismiss();
  return new Promise<T>((resolve, reject) => {
    InteractionManager.runAfterInteractions(() => {
      const delay = Platform.OS === 'ios' ? settleMs : Math.min(settleMs, 40);
      setTimeout(() => {
        fn().then(resolve, reject);
      }, delay);
    });
  });
}

/** Normalize MIME types iOS / Expo sometimes return that the API rejects. */
export function normalizeUploadMime(
  mimeType: string | null | undefined,
  uri: string,
  fileName?: string | null,
): string {
  const raw = (mimeType ?? '').trim().toLowerCase();
  if (raw === 'image/jpg' || raw === 'image/pjpeg') return 'image/jpeg';
  if (raw === 'image/x-png') return 'image/png';
  if (
    raw === 'image/jpeg' ||
    raw === 'image/png' ||
    raw === 'image/webp' ||
    raw === 'image/heic' ||
    raw === 'application/pdf'
  ) {
    return raw;
  }
  const hint = `${uri} ${fileName ?? ''}`.toLowerCase();
  if (hint.includes('.pdf')) return 'application/pdf';
  if (hint.includes('.png')) return 'image/png';
  if (hint.includes('.webp')) return 'image/webp';
  if (hint.includes('.heic')) return 'image/heic';
  return 'image/jpeg';
}
