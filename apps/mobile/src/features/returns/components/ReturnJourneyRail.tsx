import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { ReturnLifecyclePhase } from '../selectReturn';

export type ReturnJourneyStep =
  | 'REQUESTED'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'BEING_FIXED'
  | 'READY'
  | 'RETURNING'
  | 'COMPLETED';

const STEPS: Array<{ key: ReturnJourneyStep; labelKey: string }> = [
  { key: 'REQUESTED', labelKey: 'mobile.returns.journeyRequested' },
  { key: 'APPROVED', labelKey: 'mobile.returns.journeyApproved' },
  { key: 'IN_TRANSIT', labelKey: 'mobile.returns.journeyInTransit' },
  { key: 'RECEIVED', labelKey: 'mobile.returns.journeyReceived' },
  { key: 'BEING_FIXED', labelKey: 'mobile.returns.journeyBeingFixed' },
  { key: 'READY', labelKey: 'mobile.returns.journeyReady' },
  { key: 'RETURNING', labelKey: 'mobile.returns.journeyReturning' },
  { key: 'COMPLETED', labelKey: 'mobile.returns.journeyCompleted' },
];

export function journeyStepFromReturn(input: {
  phase: ReturnLifecyclePhase;
  physicalStatus?: string | null;
  approvalStatus?: string | null;
  inventoryFate?: string | null;
  lifecycleState?: string | null;
}): ReturnJourneyStep {
  const state = (input.lifecycleState ?? '').toUpperCase();
  if (state === 'REJECTED' || state === 'COMPLETED' || state === 'RETURNED_TO_STOCK' || state === 'SCRAPPED') {
    return 'COMPLETED';
  }
  if (state === 'RETURNING') return 'RETURNING';
  if (state === 'READY_TO_RETURN') return 'READY';
  if (state === 'REWORKING' || state === 'REPLACING' || state === 'INSPECTING') return 'BEING_FIXED';
  if (state === 'RECEIVED') return 'RECEIVED';
  if (state === 'IN_TRANSIT') return 'IN_TRANSIT';
  if (state === 'APPROVED') return 'APPROVED';
  if (state === 'NEED_INFO' || state === 'REQUESTED') return 'REQUESTED';

  if (input.approvalStatus === 'REJECTED' || input.phase === 'RESOLVED') return 'COMPLETED';
  if (input.phase === 'BEING_RESOLVED') return 'BEING_FIXED';
  if (input.physicalStatus === 'RETURNED' || input.physicalStatus === 'INSPECTING') return 'RECEIVED';
  if (input.physicalStatus === 'WAITING_RETURN' || input.phase === 'WAITING_RETURN') return 'IN_TRANSIT';
  if (input.approvalStatus === 'APPROVED' || input.phase === 'APPROVED') return 'APPROVED';
  return 'REQUESTED';
}

type Props = {
  phase: ReturnLifecyclePhase;
  physicalStatus?: string | null;
  approvalStatus?: string | null;
  inventoryFate?: string | null;
  lifecycleState?: string | null;
};

export function ReturnJourneyRail({
  phase,
  physicalStatus,
  approvalStatus,
  inventoryFate,
  lifecycleState,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const current = journeyStepFromReturn({
    phase,
    physicalStatus,
    approvalStatus,
    inventoryFate,
    lifecycleState,
  });
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          paddingHorizontal: theme.spacing.lg + 4,
          paddingVertical: theme.spacing.md,
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          style={{
            color: colors.brand,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            letterSpacing: 0.5,
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.returns.journeyTitle')}
        </AppText>
      </View>
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.xs }}>
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const ink = active ? colors.brand : done ? colors.success : colors.textMuted;
          return (
            <View
              key={step.key}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                minHeight: 36,
                borderRadius: theme.radius.lg,
                backgroundColor: active ? colors.brandSoft : 'transparent',
                paddingHorizontal: theme.spacing.sm,
                borderWidth: active ? 1 : 0,
                borderColor: active ? colors.brand : 'transparent',
              }}
            >
              <Ionicons
                name={done ? 'checkmark-circle' : active ? 'ellipse' : 'ellipse-outline'}
                size={18}
                color={ink}
              />
              <AppText
                weight={active ? titleWeight : 'regular'}
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: active ? colors.brand : done ? colors.textPrimary : colors.textMuted,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {t(step.labelKey)}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}
