import { resolveStatusVariant } from '@/components/badges/badgeStyles';

export type DealerStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/** Map domain status → dealer-ui badge tone. */
export function statusToDealerTone(status: string): DealerStatusTone {
  const variant = resolveStatusVariant(status.trim().toUpperCase().replace(/\s+/g, '_'));
  if (variant === 'success') return 'success';
  if (variant === 'warning') return 'warning';
  if (variant === 'error') return 'danger';
  if (variant === 'info' || variant === 'brand') return 'info';
  return 'neutral';
}
