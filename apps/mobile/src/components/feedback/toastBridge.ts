import type { ShowToastInput } from './toastQueue';

type ToastListener = (input: ShowToastInput) => void;

let listener: ToastListener | null = null;

/** Used by ToastProvider so non-React helpers can show the branded toast. */
export function registerToastListener(next: ToastListener | null) {
  listener = next;
}

/** Fire a toast from modules that cannot call `useToast()` (upload helpers, etc.). */
export function emitToast(input: ShowToastInput) {
  listener?.(input);
}

/** Combine Alert-style title + body into one toast line. */
export function toastCopy(title: string, body?: string | null): string {
  const t = title.trim();
  const b = (body ?? '').trim();
  if (!b) return t;
  if (!t) return b;
  return `${t}. ${b}`;
}
