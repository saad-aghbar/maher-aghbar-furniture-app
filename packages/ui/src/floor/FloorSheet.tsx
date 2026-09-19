import type { ReactNode } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';

export function FloorSheet({
  open,
  onClose,
  title,
  children,
  primary,
  secondary,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {children}
        <div className="flex gap-2">
          {secondary ? (
            <Button variant="secondary" className="min-h-11 flex-1 rounded-full" onClick={secondary.onClick}>
              {secondary.label}
            </Button>
          ) : null}
          {primary ? (
            <Button className="min-h-11 flex-1 rounded-full" onClick={primary.onClick}>
              {primary.label}
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
