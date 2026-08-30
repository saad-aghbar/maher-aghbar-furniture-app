import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { NeedsToBuyItem } from '../selectPurchase';

type Props = {
  items: NeedsToBuyItem[];
  canAdd: boolean;
  onAddToPurchase: (item: NeedsToBuyItem) => void;
};

/** Low-stock materials on the purchasing hub — honest qty, tappable add. */
export function NeedsToBuyBoard({ items, canAdd, onAddToPurchase }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (items.length === 0) return null;

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
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
        }}
      />
      <View
        style={{
          paddingTop: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText
          variant="heading"
          weight={titleWeight}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.purchasing.needsToBuy')}
        </AppText>
      </View>
      {items.map((item, index) => (
        <View
          key={item.id}
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            gap: theme.spacing.sm,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
            borderTopWidth: index === 0 ? 0 : 1,
            borderTopColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <AppText
                variant="label"
                weight={titleWeight}
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 16 }}
              >
                {item.name}
              </AppText>
              <AppText
                variant="caption"
                color="muted"
                dir="ltr"
                numberOfLines={1}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {item.sku}
              </AppText>
            </View>
            <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
              <AppText weight="semibold" dir="ltr" style={{ fontSize: 16 }}>
                {item.qtyLabel}
              </AppText>
              {item.incomingQty > 0 ? (
                <AppText
                  variant="caption"
                  color="muted"
                  dir="ltr"
                  style={{ fontSize: 11 }}
                >
                  {t('mobile.purchasing.incomingQty', {
                    qty: Number.isInteger(item.incomingQty)
                      ? String(item.incomingQty)
                      : item.incomingQty.toFixed(2).replace(/\.?0+$/, ''),
                  })}
                </AppText>
              ) : null}
            </View>
          </View>
          {canAdd ? (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.purchasing.addToPurchase')}
              onPress={() => {
                void haptics.selection();
                onAddToPurchase(item);
              }}
              style={{
                alignSelf: isRTL ? 'flex-end' : 'flex-start',
                minHeight: theme.sizes.touch.min,
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radius.full,
                borderWidth: 1.5,
                borderColor: colors.brand,
                backgroundColor: colors.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText
                variant="caption"
                weight={titleWeight}
                style={{ color: colors.brand, fontSize: 13 }}
              >
                {t('mobile.purchasing.addToPurchase')}
              </AppText>
            </AnimatedPressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}
