import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import { adminProductionFlowHref } from '@/features/production-flow/flowRoutes';
import type { ProductionCardModel } from '../selectProduction';

type ProductionOrderCardProps = {
  order: ProductionCardModel;
  onPress: () => void;
};

const MEDIA = 88;

function priorityLabel(priority: string, t: (key: string) => string): string {
  const key = `mobile.production.priority.${priority}`;
  const label = t(key);
  return label === key ? priority : label;
}

/**
 * Floor-list card: product media, full meta (no clipped delivery date), workflow progress.
 */
export function ProductionOrderCard({ order, onPress }: ProductionOrderCardProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();

  const pct = Math.max(0, Math.min(100, Math.round(order.progressPercent || 0)));
  const urgent = order.priority === 'URGENT' || order.priority === 'HIGH';
  const accent = order.isLate
    ? colors.error
    : urgent
      ? colors.warning
      : colors.brand;

  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dealer =
    order.dealerName && order.dealerName !== '—' ? order.dealerName : null;

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
        borderColor: order.isLate
          ? colors.error
          : urgent
            ? colors.warning
            : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...theme.elevation.card,
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: order.isLate || urgent ? 1 : 0.5,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          alignItems: 'flex-start',
        }}
      >
        <View style={{ width: MEDIA, gap: theme.spacing.xs }}>
          <View
            style={{
              width: MEDIA,
              height: MEDIA,
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              overflow: 'hidden',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {order.imageUrl ? (
              <Image
                source={{ uri: order.imageUrl }}
                style={{ width: MEDIA, height: MEDIA }}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Ionicons name="cube-outline" size={28} color={colors.brand} />
            )}
          </View>

          {urgent || order.isLate ? (
            <View
              style={{
                width: MEDIA,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                gap: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {urgent ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 3,
                    borderRadius: theme.radius.sm,
                    backgroundColor: colors.warningSoft,
                    alignItems: 'center',
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    numberOfLines={1}
                    style={{
                      color: colors.warning,
                      fontSize: 10,
                      lineHeight: 13,
                    }}
                  >
                    {priorityLabel(order.priority, t)}
                  </AppText>
                </View>
              ) : null}
              {order.isLate ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 3,
                    borderRadius: theme.radius.sm,
                    backgroundColor: colors.errorSoft,
                    alignItems: 'center',
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    numberOfLines={1}
                    style={{
                      color: colors.error,
                      fontSize: 10,
                      lineHeight: 13,
                    }}
                  >
                    {t('mobile.production.late')}
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View
          style={{
            flex: 1,
            minWidth: 0,
            gap: 4,
            alignItems: isRTL ? 'flex-end' : 'flex-start',
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
              width: '100%',
            }}
          >
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={2}
              style={{ flex: 1 }}
            >
              {order.title}
            </AppText>
            <StatusBadge status={order.status} />
          </View>

          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={1}
            dir="ltr"
            style={{ letterSpacing: 0.2 }}
          >
            {order.number}
          </AppText>

          {dealer ? (
            <AppText variant="caption" color="muted" style={{ width: '100%' }}>
              {`${t('mobile.production.dealer')}: ${dealer}`}
            </AppText>
          ) : null}

          {order.deliveryLabel ? (
            <AppText variant="caption" color="muted" style={{ width: '100%' }}>
              {`${t('mobile.production.deliveryDate')}: ${order.deliveryLabel}`}
            </AppText>
          ) : null}
        </View>
      </View>

      <View
        style={{
          marginHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          gap: theme.spacing.xs,
        }}
      >
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
            color="secondary"
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {order.progressLabel?.trim() || t('mobile.production.progress')}
          </AppText>
          <AppText
            variant="caption"
            weight="semibold"
            style={{ color: accent }}
            dir="ltr"
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
    </AnimatedPressable>
  );
}
