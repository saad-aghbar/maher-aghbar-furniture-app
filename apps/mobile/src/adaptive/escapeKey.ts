import { Platform } from 'react-native';

type EscapeListener = () => void;

/** Top-most subscriber wins — the last opened overlay handles Escape. */
const stack: EscapeListener[] = [];

/**
 * Subscribe to a hardware Escape press while an overlay is open.
 * Returns an unsubscribe function.
 *
 * Native iOS / Android core React Native does not expose global key events;
 * `emitEscape` is the bridge point for a future native key-command adapter and
 * for tests. On web the document `keydown` listener feeds it.
 */
export function subscribeEscape(listener: EscapeListener): () => void {
  stack.push(listener);
  return () => {
    const idx = stack.lastIndexOf(listener);
    if (idx >= 0) stack.splice(idx, 1);
  };
}

export function emitEscape(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}

/** Number of active Escape subscribers (tests / dev gallery). */
export function escapeSubscriberCount(): number {
  return stack.length;
}

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && emitEscape()) {
      event.preventDefault();
    }
  });
}
