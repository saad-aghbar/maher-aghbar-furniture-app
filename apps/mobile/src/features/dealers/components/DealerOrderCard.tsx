import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SalesOrderListItem } from '@/api/modules/sales-orders';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { Divider } from '@/components/layout/Divider';
import { PRODUCT_CARD_MEDIA_RATIO } from '@/features/catalog/components/ProductCard';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  order: SalesOrderListItem;
  onPress: () => void;
};

/** Fixed board width — shared by waiting / production / completed carousels. */
const CARD_W = 200;
const PAD = 12;
/** Match catalog product card media (width ÷ ratio). */
const MEDIA_H = Math.round(CARD_W / PRODUCT_CARD_MEDIA_RATIO);
const TITLE_LINES = 2;
const TITLE_LINE = 18;
const META_LINE = 16;

/**
 * Dealer CRM order board card — same rhythm for waiting, in-production, and completed.
 */
export function DealerOrderCard({ order, onPress }: Props) {
  const { t, formatCurrency, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pct =
    order.progressPercent != null
      ? Math.min(100, Math.max(0, Number(order.progressPercent)))
      : null;
  const showProgress = pct != null;
  const factoryNo = order.productionOrders?.[0]?.number?.trim() || null;
  const externalNo = order.externalOrderNumber?.trim() || null;
  const secondaryId = factoryNo ?? externalNo;
  const title = order.title?.trim() || '—';
  const imageUri = resolveOrderMediaUri(order.imageUrl);

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={`${order.number} ${title}`}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        width: CARD_W,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {/* Media plane — same crop as catalog product cards */}
      <View style={{ width: CARD_W, height: MEDIA_H, backgroundColor: colors.surfaceSecondary }}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              paddingHorizontal: PAD,
            }}
          >
            <Ionicons
              name="cube-outline"
              size={Math.round(MEDIA_H * 0.28)}
              color={colors.brand}
            />
            <AppText
              variant="caption"
              color="muted"
              numberOfLines={1}
              dir="ltr"
              style={{ fontSize: 12 }}
            >
              {order.number}
            </AppText>
          </View>
        )}

        <View
          style={{
            position: 'absolute',
            top: theme.spacing.sm,
            ...(isRTL ? { right: theme.spacing.sm } : { left: theme.spacing.sm }),
            maxWidth: CARD_W - theme.spacing.sm * 2,
          }}
        >
          <StatusBadge status={order.status} dot />
        </View>

        {/* Progress rail — reserved height so cards stay the same measure */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            backgroundColor: showProgress ? colors.border : 'transparent',
          }}
        >
          {showProgress ? (
            <View
              style={{
                width: `${pct}%`,
                height: '100%',
                backgroundColor: colors.brand,
                alignSelf: isRTL ? 'flex-end' : 'flex-start',
              }}
            />
          ) : null}
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: PAD,
          paddingTop: PAD,
          paddingBottom: PAD,
          gap: theme.spacing.sm,
        }}
      >
        {/* ID + progress % */}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.xs,
            minHeight: 20,
          }}
        >
          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={1}
            dir="ltr"
            style={{ flex: 1, fontSize: 13, lineHeight: 18 }}
          >
            {order.number}
          </AppText>
          {showProgress ? (
            <AppText
              variant="caption"
              weight="semibold"
              color="brand"
              dir="ltr"
              style={{ fontSize: 11, lineHeight: 14 }}
            >
              {`${Math.round(pct)}%`}
            </AppText>
          ) : null}
        </View>

        {/* Secondary id — fixed line so body rhythm matches across buckets */}
        {secondaryId ? (
          <AppText
            variant="caption"
            color="muted"
            numberOfLines={1}
            dir="ltr"
            style={{ fontSize: 11, lineHeight: META_LINE, minHeight: META_LINE }}
          >
            {secondaryId}
          </AppText>
        ) : (
          <View style={{ height: META_LINE }} accessibilityElementsHidden />
        )}

        <AppText
          variant="body"
          weight={titleWeight}
          numberOfLines={TITLE_LINES}
          style={{
            fontSize: 14,
            lineHeight: TITLE_LINE,
            minHeight: TITLE_LINE * TITLE_LINES,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>

        <Divider compact />

        <View style={{ gap: theme.spacing.sm }}>
          <PriceBlock
            label={t('sales.sellerPrice')}
            value={formatCurrency(Number(order.sellerPrice ?? 0))}
            isRTL={isRTL}
          />
          <PriceBlock
            label={t('sales.productionPrice')}
            value={formatCurrency(Number(order.manufacturingCost ?? 0))}
            isRTL={isRTL}
          />
        </View>
      </View>
    </AnimatedPressable>
  );
}

/** Stacked so long locale labels (e.g. Production price) never ellipsize. */
function PriceBlock({
  label,
  value,
  isRTL,
}: {
  label: string;
  value: string;
  isRTL: boolean;
}) {
  return (
    <View style={{ gap: 2 }}>
      <AppText
        variant="caption"
        color="muted"
        style={{
          fontSize: 11,
          lineHeight: 14,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight="semibold"
        dir="ltr"
        style={{
          fontSize: 13,
          lineHeight: 18,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {value}
      </AppText>
    </View>
  );
}

export const DEALER_ORDER_CARD_WIDTH = CARD_W;
