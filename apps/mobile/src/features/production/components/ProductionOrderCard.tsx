import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { Divider } from '@/components/layout/Divider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import { adminProductionFlowHref } from '@/features/production-flow/flowRoutes';
import {
  productionFloorStatusLabel,
  type ProductionCardModel,
} from '../selectProduction';

type ProductionOrderCardProps = {
  order: ProductionCardModel;
  onPress: () => void;
};

const MEDIA = 72;

function priorityLabel(priority: string, t: (key: string) => string): string {
  const key = `mobile.production.priority.${priority}`;
  const label = t(key);
  return label === key ? priority : label;
}

/**
 * Production order floor card — header band, media, inset meta, progress.
 */
export function ProductionOrderCard({ order, onPress }: ProductionOrderCardProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();

  const pct = Math.max(0, Math.min(100, Math.round(order.progressPercent || 0)));
  const urgent = order.priority === 'URGENT' || order.priority === 'HIGH';
  const late = order.isLate;
  const accent = late ? colors.error : urgent ? colors.warning : colors.brand;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dealer =
    order.dealerName && order.dealerName !== '—' ? order.dealerName : null;
  const blocked = order.boardBucket === 'blocked' && Boolean(order.readinessReason);

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={`${order.number} ${order.title} ${pct}%`}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: late ? colors.error : urgent ? colors.warning : colors.borderStrong,
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
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: late || urgent ? 0.9 : 0.55,
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
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
          }}
        >
          <StatusBadge
            status={order.status}
            dot
            label={productionFloorStatusLabel(
              order.status,
              t('mobile.production.inProduction'),
            )}
          />
          {urgent ? (
            <AppText
              variant="caption"
              weight={titleWeight}
              style={{ color: colors.warning, fontSize: 11 }}
              numberOfLines={1}
            >
              {priorityLabel(order.priority, t)}
            </AppText>
          ) : null}
          {order.startDueHint === 'due_today' ? (
            <AppText
              variant="caption"
              weight={titleWeight}
              style={{ color: colors.warning, fontSize: 11 }}
              numberOfLines={1}
            >
              {t('mobile.production.startDue.dueToday')}
            </AppText>
          ) : null}
          {order.startDueHint === 'planned_start_passed' ? (
            <AppText
              variant="caption"
              weight={titleWeight}
              style={{ color: colors.warning, fontSize: 11 }}
              numberOfLines={1}
            >
              {t('mobile.production.startDue.plannedPassed')}
            </AppText>
          ) : null}
          {late ? (
            <AppText
              variant="caption"
              weight={titleWeight}
              style={{ color: colors.error, fontSize: 11 }}
              numberOfLines={1}
            >
              {t('mobile.production.late')}
            </AppText>
          ) : null}
        </View>
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
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            alignItems: 'flex-start',
          }}
        >
          <ProductThumb uri={order.imageUrl} size={MEDIA} radius={theme.radius.lg} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <AppText
              variant="label"
              weight={titleWeight}
              dir="ltr"
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 17 }}
            >
              {order.number}
            </AppText>
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 18 }}
            >
              {order.title}
            </AppText>
          </View>
        </View>

        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: blocked ? colors.error : colors.border,
            overflow: 'hidden',
          }}
        >
          {dealer ? (
            <MetaRow label={t('mobile.production.dealer')} value={dealer} isRTL={isRTL} />
          ) : null}
          {order.deliveryLabel ? (
            <>
              {dealer ? <Divider compact plain style={{ marginVertical: 0 }} /> : null}
              <MetaRow
                label={t('mobile.production.deliveryDate')}
                value={order.deliveryLabel}
                isRTL={isRTL}
                tone={late ? 'error' : undefined}
              />
            </>
          ) : null}
          {order.progressLabel?.trim() ? (
            <>
              {dealer || order.deliveryLabel ? (
                <Divider compact plain style={{ marginVertical: 0 }} />
              ) : null}
              <MetaRow
                label={t('mobile.production.progress')}
                value={order.progressLabel.trim()}
                isRTL={isRTL}
              />
            </>
          ) : null}
          {blocked && order.readinessReason ? (
            <>
              <Divider compact plain style={{ marginVertical: 0 }} />
              <MetaRow
                label={t('mobile.production.blocked')}
                value={order.readinessReason}
                isRTL={isRTL}
                tone="error"
                multiline
              />
            </>
          ) : null}
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
              {t('mobile.production.progress')}
            </AppText>
            <AppText
              weight={titleWeight}
              dir="ltr"
              style={{ color: accent, fontSize: 15 }}
            >
              {`${pct}%`}
            </AppText>
          </View>
          <WorkflowProgressHit
            progressPercent={pct}
            height={5}
            accessibilityLabel={t('mobile.productionFlow.openWorkflow')}
            onPress={() => {
              void haptics.selection();
              router.push(adminProductionFlowHref(order.id));
            }}
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
  multiline,
  tone,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  valueLtr?: boolean;
  multiline?: boolean;
  tone?: 'error';
}) {
  const { colors, theme } = useTheme();
  const { locale } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.5,
          fontSize: 10,
          flexShrink: 0,
          textAlign: isRTL ? 'right' : 'left',
          paddingTop: multiline ? 2 : 0,
        }}
      >
        {label}
      </AppText>
      <AppText
        weight="semibold"
        dir={valueLtr ? 'ltr' : undefined}
        numberOfLines={multiline ? 3 : 1}
        style={{
          flex: 1,
          minWidth: 0,
          color: tone === 'error' ? colors.error : colors.textPrimary,
          textAlign: isRTL ? 'left' : 'right',
          lineHeight: multiline ? 20 : undefined,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
