import { Image, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import { resolveOrderMediaUri } from './OrderCardMedia';
import { orderBoardShadow } from './orderFloorStyle';

export type OrdersStreamStripModel = {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  progressPercent: number;
  progressLabel?: string | null;
  deliveryDate: string | null;
  dealerName?: string;
  sellerPrice?: number | null;
  kind?: 'order' | 'rfq';
};

type Props = {
  order: OrdersStreamStripModel;
  index: number;
  variant: 'admin' | 'dealer';
  onPress: () => void;
  onProgressPress?: () => void;
};

const MEDIA = 96;
const ROW_H = 112;

/**
 * Cinematic order strip — floor elevation + accent strip + progress.
 */
export function OrdersStreamStrip({ order, index, variant, onPress, onProgressPress }: Props) {
  const { t, formatCurrency, formatDate, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(100, Math.round(order.progressPercent || 0)));
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce
    ? {}
    : { entering: FadeInRight.delay(80 + index * 40).duration(220) };

  return (
    <Shell {...shellProps} style={{ marginBottom: theme.spacing.md }}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${order.number} ${order.title}`}
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
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.5,
            zIndex: 2,
          }}
        />
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            height: ROW_H,
            alignItems: 'stretch',
          }}
        >
          <View
            style={{
              width: MEDIA,
              height: ROW_H,
              backgroundColor: colors.surfaceSecondary,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderRightWidth: isRTL ? 0 : StyleSheet.hairlineWidth,
              borderLeftWidth: isRTL ? StyleSheet.hairlineWidth : 0,
              borderColor: colors.border,
            }}
          >
            {resolveOrderMediaUri(order.imageUrl) ? (
              <Image
                source={{ uri: resolveOrderMediaUri(order.imageUrl)! }}
                style={{ width: MEDIA, height: ROW_H }}
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
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              gap: 4,
              justifyContent: 'center',
              alignItems: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            <StatusBadge status={order.status} dot />
            <AppText variant="label" weight={titleWeight} numberOfLines={1}>
              {order.title}
            </AppText>
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={1}
              dir="ltr"
              style={{ letterSpacing: 0.2 }}
            >
              {order.kind === 'rfq' && variant === 'dealer'
                ? t('mobile.orders.rfqLabel')
                : order.number}
            </AppText>
            {variant === 'admin' && order.dealerName ? (
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {order.dealerName}
              </AppText>
            ) : null}
            {variant === 'dealer' && order.sellerPrice != null ? (
              <AppText variant="caption" color="secondary" numberOfLines={1} dir="ltr">
                {formatCurrency(order.sellerPrice)}
              </AppText>
            ) : null}
            {order.deliveryDate ? (
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {formatDate(order.deliveryDate)}
              </AppText>
            ) : null}
          </View>
        </View>
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingBottom: theme.spacing.sm,
            paddingTop: theme.spacing.xs,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            gap: 4,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <AppText variant="caption" color="secondary" numberOfLines={1} style={{ flex: 1 }}>
              {order.progressLabel?.trim() || t('mobile.orders.progress')}
            </AppText>
            <AppText variant="caption" weight="semibold" style={{ color: colors.brand }} dir="ltr">
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
    </Shell>
  );
}
