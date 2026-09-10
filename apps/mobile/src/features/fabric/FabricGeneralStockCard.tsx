import { Image, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import type { InventoryItemCardModel } from '@/features/inventory/selectInventory';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  item: InventoryItemCardModel;
  index: number;
  onPress: () => void;
  onUseForOrder?: () => void;
  canAllocate?: boolean;
};

const MEDIA = 56;

/** Fabric-native general stock roll — on hand / reserved / free. */
export function FabricGeneralStockCard({
  item,
  index,
  onPress,
  onUseForOrder,
  canAllocate,
}: Props) {
  const { t, isRTL, locale, formatNumber } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const unit = item.unit || 'm';
  const showUse = Boolean(canAllocate && onUseForOrder && item.freeQty > 0);

  return (
    <ListItemEnter index={index}>
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
        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityLabel={item.name}
          onPress={() => {
            void haptics.selection();
            onPress();
          }}
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
            <View
              style={{
                width: MEDIA,
                height: MEDIA,
                borderRadius: theme.radius.lg,
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{ width: MEDIA, height: MEDIA }}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : null}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText weight={titleWeight} numberOfLines={2} style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {item.name}
              </AppText>
              {item.sku ? (
                <AppText variant="caption" color="muted" dir="ltr">
                  {item.sku}
                </AppText>
              ) : null}
            </View>
          </View>

          <View
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.md,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            <QtyCell
              label={t('mobile.inventory.onHand')}
              value={`${formatNumber(item.onHand)} ${unit}`}
            />
            <QtyCell
              label={t('mobile.inventory.reservedLabel')}
              value={`${formatNumber(item.reservedQty)} ${unit}`}
            />
            <QtyCell
              label={t('mobile.inventory.available')}
              value={`${formatNumber(item.freeQty)} ${unit}`}
            />
          </View>
        </AnimatedPressable>
        {showUse ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.lg + 4 }
                : { paddingLeft: theme.spacing.lg + 4 }),
            }}
          >
            <PrimaryButton
              label={t('mobile.inventory.fabricUseForOrder')}
              haptic="light"
              onPress={onUseForOrder}
              style={{
                borderRadius: theme.radius.full,
                minHeight: theme.sizes.touch.min,
                paddingVertical: 0,
              }}
            />
          </View>
        ) : null}
      </View>
    </ListItemEnter>
  );
}

function QtyCell({ label, value }: { label: string; value: string }) {
  const { isRTL, locale } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </AppText>
      <AppText variant="caption" weight={titleWeight} dir="ltr" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {value}
      </AppText>
    </View>
  );
}
