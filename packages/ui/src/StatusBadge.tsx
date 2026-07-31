import { Badge, type BadgeVariant } from './Badge';

const statusVariantMap: Record<string, BadgeVariant> = {
  DRAFT: 'default',
  PENDING: 'warning',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  SENT: 'info',
  ACCEPTED: 'success',
  CONVERTED: 'success',
  REJECTED: 'error',
  EXPIRED: 'default',
  OPEN: 'info',
  SUBMITTED: 'info',
  QUOTED: 'brand',
  CLOSED: 'default',
  CANCELLED: 'error',
  CONFIRMED: 'brand',
  IN_PRODUCTION: 'info',
  READY_FOR_DELIVERY: 'success',
  DELIVERED: 'success',
  INVOICED: 'info',
  PLANNED: 'default',
  IN_PROGRESS: 'info',
  ON_HOLD: 'warning',
  BLOCKED: 'error',
  COMPLETED: 'success',
  ISSUED: 'info',
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  VOID: 'default',
  ACTIVE: 'success',
  QUEUED: 'default',
  PROCESSING: 'info',
  PENDING_REVIEW: 'warning',
  FAILED: 'error',
};

export interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const variant = statusVariantMap[status] ?? 'default';
  const display = label ?? status.replace(/_/g, ' ');

  return (
    <Badge variant={variant} className={className}>
      {display}
    </Badge>
  );
}
