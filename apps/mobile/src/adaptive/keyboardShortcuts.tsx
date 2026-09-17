import { useEffect, type ReactNode } from 'react';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { useAdaptiveSurface } from './AdaptiveSurfaceContext';
import { emitEscape } from './escapeKey';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = String(el.tagName ?? '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || Boolean(el.isContentEditable);
}

function keyEventRoot(): {
  addEventListener: (type: 'keydown', listener: (event: KeyboardEvent) => void) => void;
  removeEventListener: (type: 'keydown', listener: (event: KeyboardEvent) => void) => void;
} | null {
  if (typeof document !== 'undefined') return document;
  const g = globalThis as {
    addEventListener?: (type: string, listener: (event: KeyboardEvent) => void) => void;
    removeEventListener?: (type: string, listener: (event: KeyboardEvent) => void) => void;
  };
  if (typeof g.addEventListener === 'function' && typeof g.removeEventListener === 'function') {
    return g as {
      addEventListener: (type: 'keydown', listener: (event: KeyboardEvent) => void) => void;
      removeEventListener: (type: 'keydown', listener: (event: KeyboardEvent) => void) => void;
    };
  }
  return null;
}

/**
 * Keyboard baseline for pointer/keyboard desks.
 * Tab / Shift+Tab / Enter / Space are native focus. Escape closes overlays
 * via `emitEscape`. Cmd/Ctrl+K opens search, Cmd/Ctrl+N opens a new order
 * when the role allows it.
 *
 * Native iOS / Android do not expose a global keydown; Designed-for-iPad Mac
 * and web feed this listener when `document` or `globalThis` can. Hardware
 * Escape on iPad is bridged by `emitEscape`.
 */
export function KeyboardShortcutsHost({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const surface = useAdaptiveSurface();

  useEffect(() => {
    const root = keyEventRoot();
    if (!root) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (emitEscape()) event.preventDefault();
        return;
      }
      const meta = event.metaKey || event.ctrlKey;
      if (!meta || isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        if (surface === 'admin') {
          router.push('/(app)/(admin)/(tabs)' as Href);
        } else if (surface === 'customer') {
          router.push('/(app)/(customer)/(tabs)/catalog' as Href);
        }
        return;
      }
      if (key === 'n') {
        event.preventDefault();
        if (surface === 'admin' && can(user, 'sales-order.create')) {
          router.push('/(app)/(admin)/(tabs)/orders' as Href);
        } else if (surface === 'customer' && can(user, 'request.create')) {
          router.push('/(app)/(customer)/(tabs)/new-order' as Href);
        }
      }
    };

    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, [router, surface, user]);

  return <>{children}</>;
}
