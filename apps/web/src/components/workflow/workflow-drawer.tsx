'use client';

import { Sheet } from '@maher/ui';
import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
};

/**
 * Workflow builder drawer — a thin alias over the kit `Sheet` so every builder
 * panel (stages, versions, add-stage) shares the Board recipe, presence
 * animation, focus trap and bottom-sheet fallback below 900px.
 */
export function WorkflowDrawer({ open, title, description, onClose, children, footer, wide }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={title} description={description} footer={footer} widthClassName={wide ? 'max-w-lg' : 'max-w-md'} tone="info">
      {children}
    </Sheet>
  );
}
