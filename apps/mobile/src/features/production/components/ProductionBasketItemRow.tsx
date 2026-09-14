import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  productionFloorStatusLabel,
  type ProductionBasketItemModel,
} from '../selectProduction';

type Props = {
  item: ProductionBasketItemModel;
  onPress: () => void;
};

const THUMB = 56;

/**
 * Nested production line inside a commercial basket board — not a nested board.
 */
export function ProductionBasketItemRow({ item, onPress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const kindLabel = t(`mobile.orders.journey.kind.${item.complexity}`);
  const idle = item.fact.kind === 'idle';

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={`${item.title} ${kindLabel} ${item.fact.text}`}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        backgroundColor: item.matched ? colors.brandSoft : 'transparent',
        overflow: 'hidden',
        minHeight: THUMB + theme.spacing.sm,
      }}
    >
      {item.matched ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: colors.brand,
            ...(isRTL ? { right: 0 } : { left: 0 }),
          }}
        />
      ) : null}
      <ProductThumb uri={item.imageUrl} size={THUMB} radius={theme.radius.md} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={1}
            style={{ flex: 1, minWidth: 0, textAlign: isRTL ? 'right' : 'left' }}
          >
            {item.title}
          </AppText>
          <StatusBadge
            status={item.status}
            dot
            label={productionFloorStatusLabel(
              item.status,
              t('mobile.production.inProduction'),
            )}
          />
        </View>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
          }}
        >
          <View
            style={{
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 2,
              borderRadius: theme.radius.md,
              backgroundColor: item.matched ? colors.surface : colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.brand,
            }}
          >
            <AppText
              variant="caption"
              weight={titleWeight}
              numberOfLines={1}
              style={{ color: colors.brand, fontSize: 10, lineHeight: 12 }}
            >
              {kindLabel}
            </AppText>
          </View>
          {item.isLate ? (
            <AppText variant="caption" style={{ color: colors.error, fontSize: 11 }}>
              {t('mobile.production.late')}
            </AppText>
          ) : null}
        </View>
        <AppText
          variant="caption"
          numberOfLines={1}
          dir="ltr"
          style={{
            color: idle ? colors.textMuted : colors.textSecondary,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {item.fact.text}
        </AppText>
      </View>
    </AnimatedPressable>
  );
}
