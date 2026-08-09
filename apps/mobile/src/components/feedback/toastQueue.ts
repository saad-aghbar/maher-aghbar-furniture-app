export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
};

export type ShowToastInput = {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

let toastSeq = 0;

export function createToastId(): string {
  toastSeq += 1;
  return `toast-${toastSeq}`;
}

export function enqueueToast(queue: ToastItem[], input: ShowToastInput): ToastItem[] {
  const item: ToastItem = {
    id: createToastId(),
    message: input.message,
    variant: input.variant ?? 'info',
    durationMs: input.durationMs ?? 3200,
  };
  return [...queue, item];
}

export function dismissToast(queue: ToastItem[], id: string): ToastItem[] {
  return queue.filter((t) => t.id !== id);
}

export function peekToast(queue: ToastItem[]): ToastItem | null {
  return queue[0] ?? null;
}
