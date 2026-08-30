'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { Badge, type BadgeVariant } from './Badge';

const statusVariantMap: Record<string, BadgeVariant> = {
  DRAFT: 'default',
  PENDING: 'warning',
  PENDING_APPROVAL: 'warning',
  INTERNAL_REVIEW: 'warning',
  APPROVED: 'success',
  SENT: 'info',
  VIEWED: 'info',
  ACCEPTED: 'success',
  CONVERTED: 'success',
  REJECTED: 'error',
  REVISION_REQUESTED: 'warning',
  EXPIRED: 'default',
  OPEN: 'info',
  SUBMITTED: 'info',
  QUOTED: 'brand',
  CLOSED: 'default',
  CANCELLED: 'error',
  CONFIRMED: 'brand',
  IN_PRODUCTION: 'info',
  READY_FOR_PRODUCTION: 'info',
  READY_FOR_DELIVERY: 'success',
  DELIVERED: 'success',
  INVOICED: 'info',
  PLANNED: 'default',
  READY: 'success',
  IN_PROGRESS: 'info',
  ON_HOLD: 'warning',
  BLOCKED: 'error',
  COMPLETED: 'success',
  WAITING_FOR_MATERIALS: 'warning',
  QUALITY_CHECK: 'info',
  NOT_STARTED: 'default',
  PAUSED: 'warning',
  READY_FOR_INSPECTION: 'info',
  ISSUED: 'info',
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  OVERDUE: 'error',
  VOID: 'default',
  ACTIVE: 'success',
  INACTIVE: 'default',
  QUEUED: 'default',
  PROCESSING: 'info',
  PENDING_REVIEW: 'warning',
  FAILED: 'error',
  OUT_FOR_DELIVERY: 'info',
  PASSED: 'success',
  PASSED_WITH_NOTES: 'success',
  FAILED_REWORK_REQUIRED: 'error',
  PROPOSED: 'info',
  SUPERSEDED: 'default',
  NEEDS_REVIEW: 'warning',
  SETUP_REQUIRED: 'warning',
  SETUP_IN_PROGRESS: 'info',
  READY_FOR_RELEASE: 'success',
  RELEASED: 'success',
  SHORTAGE: 'warning',
  NEEDS_SELECTION: 'warning',
  PROVISIONAL: 'warning',
  ESTIMATED: 'default',
  AWAITING_APPROVAL: 'warning',
  AT_RISK: 'error',
  RESCHEDULED: 'warning',
  AWAITING_CONFIRMATION: 'warning',
  CONFIRMED_ON_TRACK: 'success',
  MAY_BE_DELAYED: 'warning',
  DELAYED: 'error',
  PUBLISHED: 'success',
  ARCHIVED: 'default',
  AVAILABLE: 'success',
  RESERVED: 'warning',
  QUARANTINED: 'warning',
  CONSUMED: 'default',
  DAMAGED: 'error',
  SCRAPPED: 'error',
  SCRAP: 'error',
  RETURN_TO_STOCK: 'success',
  REWORK: 'warning',
  IN_TRANSIT: 'info',
  POSTED: 'success',
};

type StatusTranslator = (status: string) => string | undefined;

const StatusLabelContext = createContext<StatusTranslator | null>(null);

export function StatusLabelProvider({
  translate,
  children,
}: {
  translate: StatusTranslator;
  children: ReactNode;
}) {
  return (
    <StatusLabelContext.Provider value={translate}>{children}</StatusLabelContext.Provider>
  );
}

export interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

function englishFallback(status: string) {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const translate = useContext(StatusLabelContext);
  const variant = statusVariantMap[status] ?? 'default';
  const display = label ?? translate?.(status) ?? englishFallback(status);

  return (
    <Badge variant={variant} dot className={className}>
      {display}
    </Badge>
  );
}
