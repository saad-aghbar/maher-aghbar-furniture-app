'use client';

import type { ReactNode } from 'react';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { DEFAULT_DESK_COPY } from './desk-copy';

export interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  onApply: () => void;
  onClear?: () => void;
  applyLabel?: string;
  clearLabel?: string;
  cancelLabel?: string;
}

/** Desktop stand-in for a mobile filter sheet. */
export function FilterPanel({
  open,
  onClose,
  title,
  description,
  children,
  onApply,
  onClear,
  applyLabel = DEFAULT_DESK_COPY.filterApply,
  clearLabel = DEFAULT_DESK_COPY.filterClear,
  cancelLabel = DEFAULT_DESK_COPY.cancel,
}: FilterPanelProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      footer={
        <>
          {onClear ? (
            <Button type="button" variant="ghost" onClick={onClear}>
              {clearLabel}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onClose}>
              {cancelLabel}
            </Button>
          )}
          <Button
            type="button"
            onClick={() => {
              onApply();
              onClose();
            }}
          >
            {applyLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">{children}</div>
    </Modal>
  );
}

export function FilterSection({
  title,
  icon,
  active,
  children,
}: {
  title: string;
  icon?: ReactNode;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-[var(--maher-radius-xl)] border border-[var(--maher-border)] bg-[var(--maher-surface)]"
    >
      {active ? (
        <span aria-hidden className="absolute inset-y-0 start-0 w-[3px] bg-[var(--maher-brand)]" />
      ) : null}
      <header className="flex items-center gap-2 border-b border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-4 py-2.5">
        {icon ? <span className="text-[var(--maher-brand)]">{icon}</span> : null}
        <h3 className="text-sm font-medium text-[var(--maher-text-primary)]">{title}</h3>
      </header>
      <div className="flex flex-wrap gap-2 p-4">{children}</div>
    </section>
  );
}
