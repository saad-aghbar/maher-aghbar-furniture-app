'use client';

import { Ltr } from '@maher/ui';

/** Compact dual order-number display: factory/system + dealer. */
export function OrderNumbers({
  systemNumber,
  dealerNumber,
  systemLabel,
  dealerLabel,
  className = '',
}: {
  systemNumber?: string | null;
  dealerNumber?: string | null;
  systemLabel: string;
  dealerLabel: string;
  className?: string;
}) {
  if (!systemNumber && !dealerNumber) return null;
  return (
    <div className={`space-y-0.5 ${className}`}>
      {systemNumber ? (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          <span className="font-medium normal-case tracking-normal text-text-tertiary">
            {systemLabel}:{' '}
          </span>
          <Ltr>{systemNumber}</Ltr>
        </p>
      ) : null}
      {dealerNumber ? (
        <p className="truncate text-xs text-text-secondary">
          <span className="text-text-tertiary">{dealerLabel}: </span>
          <Ltr>{dealerNumber}</Ltr>
        </p>
      ) : null}
    </div>
  );
}
