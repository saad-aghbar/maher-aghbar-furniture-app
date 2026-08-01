import { Platform } from 'react-native';

export const colors = {
  brand: '#E03C31',
  brandDark: '#B82E25',
  brandSoft: '#FDECEA',
  background: '#F7F5F2',
  surface: '#FFFFFF',
  surfaceMuted: '#F2EFEB',
  border: '#E5E2DE',
  borderStrong: '#D2CDC7',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6560',
  textTertiary: '#9A938C',
  success: '#1F7A4C',
  successSoft: '#E6F4EC',
  warning: '#B86E00',
  warningSoft: '#FDF1DC',
  error: '#C62828',
  errorSoft: '#FDECEA',
  info: '#1565C0',
  infoSoft: '#E7F0FB',
  overlay: 'rgba(16, 14, 13, 0.45)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading: { fontSize: 17, fontWeight: '600' as const },
  subheading: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  micro: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.3 },
} as const;

/** Minimum touch target for accessible tap areas on a shop floor. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const MIN_TOUCH = 48;

export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#1A1A1A',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  raised: Platform.select({
    ios: {
      shadowColor: '#1A1A1A',
      shadowOpacity: 0.12,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 6 },
    default: {},
  }),
} as const;

export type Tone = 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

export const toneColor: Record<Tone, { fg: string; bg: string }> = {
  brand: { fg: colors.brand, bg: colors.brandSoft },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  error: { fg: colors.error, bg: colors.errorSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  neutral: { fg: colors.textSecondary, bg: colors.surfaceMuted },
};

/** Maps a backend status/priority enum to a visual tone. */
export function statusTone(status: string | null | undefined): Tone {
  if (!status) return 'neutral';
  switch (status) {
    case 'ACCEPTED':
    case 'APPROVED':
    case 'COMPLETED':
    case 'DELIVERED':
    case 'PAID':
    case 'ACTIVE':
    case 'PASSED':
    case 'CONFIRMED':
    case 'RECEIVED':
    case 'CLOSED':
      return 'success';
    case 'PENDING':
    case 'PENDING_APPROVAL':
    case 'PENDING_REVIEW':
    case 'INTERNAL_REVIEW':
    case 'UNDER_REVIEW':
    case 'NEEDS_INFORMATION':
    case 'WAITING_FOR_MATERIALS':
    case 'ON_HOLD':
    case 'PAUSED':
    case 'PARTIALLY_PAID':
    case 'PARTIALLY_RECEIVED':
    case 'REVISION_REQUESTED':
    case 'PASSED_WITH_NOTES':
    case 'RESCHEDULED':
    case 'HIGH':
      return 'warning';
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
    case 'OVERDUE':
    case 'BLOCKED':
    case 'FAILED':
    case 'FAILED_REWORK_REQUIRED':
    case 'VOID':
    case 'INACTIVE':
    case 'URGENT':
      return 'error';
    case 'IN_PROGRESS':
    case 'IN_PRODUCTION':
    case 'PROCESSING':
    case 'OUT_FOR_DELIVERY':
    case 'SENT':
    case 'VIEWED':
    case 'QUALITY_CHECK':
    case 'READY_FOR_INSPECTION':
      return 'info';
    case 'READY':
    case 'READY_FOR_PRODUCTION':
    case 'READY_FOR_DELIVERY':
    case 'READY_FOR_QUOTATION':
    case 'READY_FOR_PACKAGING':
    case 'QUOTED':
    case 'SUBMITTED':
    case 'ISSUED':
    case 'ORDERED':
    case 'CONVERTED':
      return 'brand';
    default:
      return 'neutral';
  }
}
