'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';
import { Stamp } from '../board/Stamp';
import type { BoardTone } from '../board/tone';
import { useCanPortal } from './use-presence';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: BoardTone;
  /** ms; 0 = sticky until dismissed. Default 4200. */
  duration?: number;
  action?: { label: ReactNode; onClick: () => void };
}

type ToastRecord = ToastOptions & { id: number; leaving: boolean };

type ToastApi = {
  toast: (opts: ToastOptions) => number;
  dismiss: (id: number) => void;
  success: (title: ReactNode, description?: ReactNode) => number;
  error: (title: ReactNode, description?: ReactNode) => number;
  info: (title: ReactNode, description?: ReactNode) => number;
};

const ToastContext = createContext<ToastApi | null>(null);

let seq = 0;

/** Hosts toasts bottom-end. Paper boards with a tone stamp; no icons, no red blocks. */
export function ToastProvider({ children, closeLabel = 'Dismiss' }: { children: ReactNode; closeLabel?: string }) {
  const [items, setItems] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const canPortal = useCanPortal();

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => remove(id), 170);
    },
    [remove],
  );

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = ++seq;
      setItems((list) => [...list.slice(-3), { ...opts, id, leaving: false }]);
      const duration = opts.duration ?? 4200;
      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, tone: 'success' }),
      error: (title, description) => toast({ title, description, tone: 'error', duration: 6500 }),
      info: (title, description) => toast({ title, description, tone: 'info' }),
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {canPortal
        ? createPortal(
            <div
              className="pointer-events-none fixed inset-x-0 bottom-0 z-[1300] flex flex-col items-end gap-2 p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] sm:items-end"
              aria-live="polite"
              aria-relevant="additions"
            >
              {items.map((t) => (
                <div
                  key={t.id}
                  role="status"
                  className={cn(
                    'maher-toast maher-board pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[16px] border border-[var(--maher-border)] bg-[var(--maher-surface)] px-4 py-3',
                    t.leaving && 'maher-toast--leaving',
                  )}
                >
                  <Stamp tone={t.tone ?? 'brand'} className="mt-[7px]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold leading-5 text-[var(--maher-text-primary)]">{t.title}</p>
                    {t.description ? (
                      <p className="mt-0.5 text-[13px] leading-5 text-[var(--maher-text-secondary)]">{t.description}</p>
                    ) : null}
                    {t.action ? (
                      <button
                        type="button"
                        className="maher-press mt-2 text-[13px] font-semibold text-[var(--maher-brand)]"
                        onClick={() => {
                          t.action?.onClick();
                          dismiss(t.id);
                        }}
                      >
                        {t.action.label}
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label={closeLabel}
                    onClick={() => dismiss(t.id)}
                    className="maher-press -me-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[var(--maher-text-tertiary)] hover:bg-[var(--maher-surface-muted)] hover:text-[var(--maher-text-primary)]"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                      <path d="m5 5 10 10M15 5 5 15" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

/** Safe in trees that may render without a provider (tests, storybook). */
export function useOptionalToast(): ToastApi | null {
  return useContext(ToastContext);
}
