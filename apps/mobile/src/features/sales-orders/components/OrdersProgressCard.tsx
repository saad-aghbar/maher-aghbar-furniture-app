import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import { resolveOrderMediaUri } from './OrderCardMedia';
import { orderBoardShadow } from './orderFloorStyle';

export type OrdersProgressCardModel = {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  progressPercent: number;
  progressLabel?: string | null;
  deliveryDate: string | null;
  arrivedAt: string | null;
  dealerId?: string;
  dealerName?: string;
  sellerPrice?: number | null;
  kind?: 'order' | 'rfq';
  priority?: string;
};

type Props = {
  order: OrdersProgressCardModel;
  variant: 'admin' | 'dealer';
  onPress: () => void;
  onProgressPress?: () => void;
};

const MEDIA = 88;

/**
 * Floor-list order card — soft elevation, accent strip, progress row.
 */
export function OrdersProgressCard({ order, variant, onPress, onProgressPress }: Props) {
  const { t, formatCurrency, formatDate, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const pct = Math.max(0, Math.min(100, Math.round(order.progressPercent || 0)));
  const urgent =
    (order.priority ?? '').toUpperCase() === 'URGENT' ||
    (order.priority ?? '').toUpperCase() === 'HIGH';
  const accent = urgent ? colors.warning : colors.brand;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

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
        borderColor: urgent ? colors.warning : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        marginBottom: theme.spacing.sm,
        ...orderBoardShadow(colorScheme),
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
          opacity: urgent ? 1 : 0.5,
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
          {resolveOrderMediaUri(order.imageUrl) ? (
            <Image
              source={{ uri: resolveOrderMediaUri(order.imageUrl)! }}
              style={{ width: MEDIA, height: MEDIA }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Ionicons name="cube-outline" size={28} color={colors.brand} />
          )}
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
            <StatusBadge status={order.status} dot />
          </View>

          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={1}
            dir={order.kind === 'rfq' && variant === 'dealer' ? 'auto' : 'ltr'}
            style={{ letterSpacing: 0.2 }}
          >
            {order.kind === 'rfq'
              ? variant === 'dealer'
                ? t('mobile.orders.rfqLabel')
                : `${t('mobile.orders.unapprovedLabel')} · ${order.number}`
              : order.number}
          </AppText>

          {variant === 'admin' && order.dealerName ? (
            <AppText variant="caption" color="muted" style={{ width: '100%' }}>
              {`${t('mobile.orders.dealer')}: ${order.dealerName}`}
            </AppText>
          ) : null}
          {variant === 'dealer' && order.sellerPrice != null ? (
            <AppText
              variant="caption"
              color="muted"
              dir="ltr"
              style={{ width: '100%' }}
            >
              {formatCurrency(order.sellerPrice)}
            </AppText>
          ) : null}
          {order.deliveryDate ? (
            <AppText variant="caption" color="muted" style={{ width: '100%' }}>
              {formatDate(order.deliveryDate)}
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
            {order.progressLabel?.trim() || t('mobile.orders.progress')}
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
          accessibilityLabel={
            onProgressPress ? t('mobile.productionFlow.openWorkflow') : undefined
          }
          onPress={
            onProgressPress
              ? () => {
                  void haptics.selection();
                  onProgressPress();
                }
              : undefined
          }
        />
      </View>
    </AnimatedPressable>
  );
}
