import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { EmptyProductImage } from '@/components/media/EmptyProductImage';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { NewOrderQtyStepper } from './NewOrderQtyStepper';
import { basketLineKind } from '../newOrderBasket';
import type { NewOrderLine } from '../newOrderLine';
import { lineVisualIdentity } from '@maher/types';

type Props = {
  line: NewOrderLine;
  index: number;
  onChange: (next: NewOrderLine) => void;
  onRemove: () => void;
  onEdit: () => void;
};

/**
 * Factory docket card for one basket piece — stamp, kind, trash well, no inline name field.
 */
export function OrderBasketLineCard({
  line,
  index,
  onChange,
  onRemove,
  onEdit,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const kind = basketLineKind(line);
  const custom = kind === 'custom';
  const title =
    line.customProductName.trim() ||
    line.variantLabel.trim() ||
    t('mobile.newOrder.untitledModel');
  const fabric =
    line.fabrics.find((row) => row.type.trim() || row.color.trim()) ?? null;
  const imageUri = lineVisualIdentity({
    productImageRef: line.imageUrl || line.photoUris[0],
    photoUrls: line.photoUris,
  });
  const dealerPrice = custom ? '' : line.dealerPrice.trim();
  const editLabel = custom
    ? t('mobile.newOrder.editCustomItem')
    : t('mobile.newOrder.editProductVariant');
  const accent = custom ? colors.warning : colors.brand;

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
          backgroundColor: accent,
          opacity: custom ? 0.9 : 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
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
            width: 36,
            height: 36,
            borderRadius: theme.radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: custom ? colors.warningSoft : colors.brandSoft,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AppText variant="caption" weight={titleWeight} dir="ltr">
            {index + 1}
          </AppText>
        </View>
        <View
          style={{
            flex: 1,
            minWidth: 0,
            gap: 4,
            alignItems: isRTL ? 'flex-end' : 'flex-start',
          }}
        >
          <AppText variant="label" weight={titleWeight} numberOfLines={1}>
            {title}
          </AppText>
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: accent,
              backgroundColor: custom ? colors.warningSoft : colors.brandSoft,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 2,
            }}
          >
            <AppText
              variant="caption"
              weight="medium"
              color={custom ? 'warning' : 'brand'}
            >
              {t(`mobile.lineKind.${kind}`)}
            </AppText>
          </View>
        </View>
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
          testID={`order-basket-remove-${line.id}`}
          onPress={() => {
            void haptics.selection();
            onRemove();
          }}
          style={{
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: theme.radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.errorSoft,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="trash-outline" size={16} color={colors.error} />
        </AnimatedPressable>
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
          }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={{ width: 88, height: 88 }} />
            ) : (
              <EmptyProductImage />
            )}
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xs, justifyContent: 'center' }}>
            {line.variantLabel.trim() && line.productId.trim() ? (
              <AppText variant="caption" color="muted">
                {line.variantLabel}
              </AppText>
            ) : null}
            {line.variantSku.trim() ? (
              <AppText variant="caption" color="muted" dir="ltr">
                {line.variantSku}
              </AppText>
            ) : null}
            {fabric ? (
              <AppText variant="caption" color="muted">
                {t('mobile.orderDetail.fabric')}:{' '}
                {[fabric.type, fabric.color].filter(Boolean).join(' / ')}
              </AppText>
            ) : null}
            {custom ? (
              <AppText variant="caption" weight="medium" color="warning">
                {t('mobile.newOrder.waitingForFactoryPrice')}
              </AppText>
            ) : dealerPrice ? (
              <AppText variant="caption" dir="ltr">
                {dealerPrice} ₪
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
          }}
        >
          <NewOrderQtyStepper
            value={line.quantity}
            onChange={(quantity) => onChange({ ...line, quantity })}
          />
        </View>

        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={editLabel}
          testID={`order-basket-edit-${line.id}`}
          onPress={() => {
            void haptics.selection();
            onEdit();
          }}
          style={{
            minHeight: theme.sizes.touch.min,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.brand,
            backgroundColor: colors.brandSoft,
            paddingHorizontal: theme.spacing.md,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <Ionicons name="create-outline" size={16} color={colors.brand} />
          <AppText weight={titleWeight} color="brand">
            {editLabel}
          </AppText>
        </AnimatedPressable>
      </View>
    </View>
  );
}
