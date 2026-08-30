import type { Theme, ThemeColors } from '@/theme';
import type { TextStyle, ViewStyle } from 'react-native';

export type BadgeVariant = 'default' | 'brand' | 'success' | 'warning' | 'error' | 'info';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

/** Domain status → badge variant (coffee/brand family — no traffic blue/green/red). */
export const statusVariantMap: Record<string, BadgeVariant> = {
  DRAFT: 'default',
  PENDING: 'warning',
  PENDING_APPROVAL: 'warning',
  INTERNAL_REVIEW: 'warning',
  APPROVED: 'success',
  SENT: 'brand',
  VIEWED: 'brand',
  ACCEPTED: 'success',
  CONVERTED: 'success',
  REJECTED: 'error',
  REVISION_REQUESTED: 'warning',
  EXPIRED: 'default',
  OPEN: 'brand',
  SUBMITTED: 'brand',
  QUOTED: 'brand',
  CLOSED: 'default',
  CANCELLED: 'error',
  CONFIRMED: 'brand',
  IN_PRODUCTION: 'brand',
  READY_FOR_PRODUCTION: 'brand',
  READY_FOR_DELIVERY: 'success',
  DELIVERED: 'success',
  INVOICED: 'brand',
  PLANNED: 'default',
  READY: 'success',
  IN_PROGRESS: 'brand',
  ON_HOLD: 'warning',
  BLOCKED: 'error',
  COMPLETED: 'success',
  WAITING_FOR_MATERIALS: 'warning',
  WAITING_FOR_PAYMENT: 'warning',
  PREPARING: 'brand',
  READY_TO_START: 'info',
  SPEC_INCOMPLETE: 'warning',
  SPEC_COMPLETE: 'success',
  QUALITY_CHECK: 'brand',
  NOT_STARTED: 'default',
  PAUSED: 'warning',
  READY_FOR_INSPECTION: 'brand',
  ISSUED: 'brand',
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  OVERDUE: 'error',
  VOID: 'default',
  ACTIVE: 'success',
  INACTIVE: 'default',
  QUEUED: 'default',
  PROCESSING: 'brand',
  PENDING_REVIEW: 'warning',
  FAILED: 'error',
  OUT_FOR_DELIVERY: 'brand',
  PASSED: 'success',
  PASSED_WITH_NOTES: 'success',
  FAILED_REWORK_REQUIRED: 'error',
  // Scheduling — dealer-safe promise states + raw schedule statuses (admin).
  ESTIMATED: 'default',
  AWAITING_APPROVAL: 'warning',
  AT_RISK: 'warning',
  RESCHEDULED: 'warning',
  PROPOSED: 'brand',
  SUPERSEDED: 'default',
  PROVISIONAL: 'default',
  NEEDS_REVIEW: 'warning',
  LATE: 'warning',
  AWAITING_CONFIRMATION: 'warning',
  CONFIRMED_ON_TRACK: 'success',
  MAY_BE_DELAYED: 'warning',
  DELAYED: 'error',
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

export const priorityVariantMap: Record<PriorityLevel, BadgeVariant> = {
  low: 'default',
  medium: 'brand',
  high: 'warning',
  urgent: 'error',
};

export function resolveStatusVariant(status: string): BadgeVariant {
  return statusVariantMap[status] ?? 'default';
}

export function resolvePriorityVariant(priority: PriorityLevel): BadgeVariant {
  return priorityVariantMap[priority];
}

export function englishStatusFallback(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function softFill(colors: ThemeColors, variant: BadgeVariant): { bg: string; fg: string } {
  switch (variant) {
    case 'brand':
      return { bg: colors.brandSoft, fg: colors.brand };
    case 'success':
      return { bg: colors.successSoft, fg: colors.success };
    case 'warning':
      return { bg: colors.warningSoft, fg: colors.warning };
    case 'error':
      return { bg: colors.errorSoft, fg: colors.error };
    case 'info':
      return { bg: colors.infoSoft, fg: colors.info };
    default:
      return { bg: colors.surfaceSecondary, fg: colors.textSecondary };
  }
}

export function getBadgeContainerStyle(
  theme: Theme,
  variant: BadgeVariant,
  opts: { isRTL?: boolean } = {},
): ViewStyle {
  const { bg } = softFill(theme.colors, variant);
  const isRTL = Boolean(opts.isRTL);
  return {
    alignSelf: isRTL ? 'flex-end' : 'flex-start',
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing['2xs'],
    maxWidth: '100%',
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: isRTL ? theme.spacing.xs : theme.spacing['2xs'],
    borderRadius: theme.radius.full,
    backgroundColor: bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  };
}

export function getBadgeLabelStyle(theme: Theme, variant: BadgeVariant): TextStyle {
  const { fg } = softFill(theme.colors, variant);
  return {
    color: fg,
    fontSize: theme.typography.variants.caption.fontSize,
    lineHeight: theme.typography.variants.caption.lineHeight,
  };
}

export function getBadgeDotColor(theme: Theme, variant: BadgeVariant): string {
  return softFill(theme.colors, variant).fg;
}
