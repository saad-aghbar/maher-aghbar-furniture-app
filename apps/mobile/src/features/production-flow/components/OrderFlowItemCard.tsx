import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { Divider } from '@/components/layout/Divider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { OrderFlowItem } from '../selectOrderFlowItems';

type Props = {
  item: OrderFlowItem;
  onPress: () => void;
};

/**
 * One sales-order production item — parchment board: variant, qty, workflow, stage, progress.
 */
export function OrderFlowItemCard({ item, onPress }: Props) {
  const { t, isRTL, locale, formatNumber } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pct = Math.max(0, Math.min(100, Math.round(item.progressPercent || 0)));
  const accent = pct >= 100 || item.status === 'COMPLETED' ? colors.success : colors.brand;
  const qtyLabel =
    item.quantity != null ? formatNumber(item.quantity) : t('mobile.productionFlow.quantityUnset');

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={`${item.variantLabel} ${pct}%`}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
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
          backgroundColor: accent,
          opacity: 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <StatusBadge status={item.status} dot />
        <AppText variant="caption" color="brand" weight={titleWeight}>
          {t('common.details')}
        </AppText>
      </View>

      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <View style={{ gap: 4 }}>
          <AppText variant="label" weight={titleWeight} numberOfLines={2}>
            {item.variantLabel}
          </AppText>
          <AppText variant="caption" color="muted" dir="ltr" numberOfLines={1}>
            {item.number}
          </AppText>
        </View>

        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <MetaRow
            label={t('mobile.orderDetail.qty')}
            value={qtyLabel}
            isRTL={isRTL}
            valueLtr
          />
          <Divider compact plain style={{ marginVertical: 0 }} />
          <MetaRow
            label={t('mobile.productionFlow.orderItemWorkflow')}
            value={item.workflowName?.trim() || t('mobile.productionFlow.workflowUnset')}
            isRTL={isRTL}
          />
          <Divider compact plain style={{ marginVertical: 0 }} />
          <MetaRow
            label={t('mobile.productionFlow.currentStage')}
            value={item.currentStageName?.trim() || t('mobile.productionFlow.stageUnset')}
            isRTL={isRTL}
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <AppText
              variant="caption"
              color="muted"
              style={{
                flex: 1,
                textAlign: isRTL ? 'right' : 'left',
                fontSize: 10,
                letterSpacing: locale === 'ar' ? 0 : 0.45,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
              }}
            >
              {item.progressLabel?.trim() || t('mobile.production.progress')}
            </AppText>
            <AppText weight={titleWeight} dir="ltr" style={{ color: accent, fontSize: 15 }}>
              {`${pct}%`}
            </AppText>
          </View>
          <WorkflowProgressHit
            progressPercent={pct}
            height={5}
            accessibilityLabel={t('mobile.productionFlow.openWorkflow')}
          />
        </View>
      </View>
    </AnimatedPressable>
  );
}

function MetaRow({
  label,
  value,
  isRTL,
  valueLtr,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  valueLtr?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
      }}
    >
      <AppText variant="caption" color="muted" style={{ flexShrink: 0 }}>
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight="medium"
        numberOfLines={2}
        dir={valueLtr ? 'ltr' : undefined}
        style={{ flex: 1, textAlign: isRTL ? 'left' : 'right' }}
      >
        {value}
      </AppText>
    </View>
  );
}
