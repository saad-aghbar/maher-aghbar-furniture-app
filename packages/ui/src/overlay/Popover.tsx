'use client';

import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  type Placement,
} from '@floating-ui/react-dom';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';
import { useCanPortal, useEscape } from './use-presence';

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The element the popover is anchored to. */
  anchor: HTMLElement | null;
  children: ReactNode;
  placement?: Placement;
  /** Match the anchor's width (for listboxes). */
  matchWidth?: boolean;
  className?: string;
  role?: 'dialog' | 'listbox' | 'menu';
  'aria-label'?: string;
  /** Extra elements that should not count as "outside" (e.g. the trigger). */
  ignoreOutside?: Array<HTMLElement | null>;
}

/**
 * Popover — anchored floating paper. Flips and shifts to stay in view,
 * closes on Escape / outside pointer-down. Renders in a portal.
 */
export function Popover({
  open,
  onClose,
  anchor,
  children,
  placement = 'bottom-start',
  matchWidth,
  className,
  role = 'dialog',
  ignoreOutside,
  ...aria
}: PopoverProps) {
  const canPortal = useCanPortal();
  // `transform: false` → floating-ui positions with top/left, so the entrance
  // animation (which animates transform) never fights the placement.
  const { refs, floatingStyles, update } = useFloating({
    placement,
    strategy: 'fixed',
    transform: false,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, elements, rects }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.max(160, Math.min(availableHeight, 480))}px`,
            ...(matchWidth ? { width: `${rects.reference.width}px` } : null),
          });
        },
      }),
    ],
  });
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    refs.setReference(anchor);
    update();
  }, [anchor, refs, update]);

  useEscape(open, onClose);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (contentRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      if (ignoreOutside?.some((el) => el?.contains(target))) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointer, true);
    return () => document.removeEventListener('pointerdown', onPointer, true);
  }, [open, onClose, anchor, ignoreOutside]);

  if (!open || !canPortal) return null;

  return createPortal(
    <div
      ref={(node) => {
        contentRef.current = node;
        refs.setFloating(node);
      }}
      role={role}
      style={floatingStyles}
      className={cn('maher-popover z-[1250] overflow-auto p-1.5', className)}
      {...aria}
    >
      {children}
    </div>,
    document.body,
  );
}
