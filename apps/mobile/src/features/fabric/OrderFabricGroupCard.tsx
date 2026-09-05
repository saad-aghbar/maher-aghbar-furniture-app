import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { FabricRowBody } from './FabricRowBody';
import { resolveFabricTone } from './fabricToneVisuals';
import type { FabricOrderGroup, FabricStatusSurface, FabricTrackerRow } from './selectFabricTracker';

type Props = {
  group: FabricOrderGroup;
  onPressOrder?: () => void;
  onPressFabric: (row: FabricTrackerRow) => void;
  surface?: FabricStatusSurface;
  /** Purchasing shows supplier on child rows. */
  showSupplier?: boolean;
  index?: number;
};

/**
 * ORDER is the parent. Fabrics are children. The sales order number appears
 * once — never on every fabric row.
 */
export function OrderFabricGroupCard({
  group,
  onPressOrder,
  onPressFabric,
  surface = 'desk',
  showSupplier = false,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const visual = resolveFabricTone(group.tone, colors);
  const railOpacity = group.tone === 'neutral' ? 0.55 : 0.9;
  const readyLabel = t('mobile.purchasing.fabricReadyCount', {
    ready: group.readyCount,
    required: group.requiredCount,
  });

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: group.tone === 'blocked' ? visual.rail : colors.borderStrong,
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
          backgroundColor: visual.rail,
          opacity: railOpacity,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />

      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${group.orderNumber ?? ''} ${readyLabel}`.trim()}
        disabled={!onPressOrder}
        onPress={() => {
          if (!onPressOrder) return;
          void haptics.selection();
          onPressOrder();
        }}
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
          gap: theme.spacing.sm,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          {group.orderNumber ? (
            <AppText
              variant="label"
              weight={titleWeight}
              dir="ltr"
              style={{ flexShrink: 1, fontSize: 16, color: colors.brand }}
            >
              {group.orderNumber}
            </AppText>
          ) : (
            <AppText variant="caption" color="muted">
              {t('mobile.inventory.fabricUnassignedOrder')}
            </AppText>
          )}
          <AppText
            variant="caption"
            weight={titleWeight}
            dir="ltr"
            style={{ color: group.attention ? colors.warning : colors.textMuted }}
          >
            {readyLabel}
          </AppText>
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            alignItems: 'center',
          }}
        >
          <ProductThumb uri={group.productImageUrl} size={56} radius={theme.radius.lg} />
          <View style={{ flex: 1, gap: 2 }}>
            {group.productName ? (
              <AppText
                weight={titleWeight}
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {group.productName}
              </AppText>
            ) : null}
            {group.dealerName ? (
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={1}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {group.dealerName}
              </AppText>
            ) : null}
            {group.attention ? (
              <AppText variant="caption" style={{ color: colors.warning }}>
                {t('mobile.inventory.fabricOrderAttention')}
              </AppText>
            ) : null}
          </View>
          {onPressOrder ? (
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={16}
              color={colors.textMuted}
            />
          ) : null}
        </View>
      </AnimatedPressable>

      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            color: colors.brand,
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            marginBottom: theme.spacing.xs,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.inventory.fabricChildrenEyebrow')}
        </AppText>
        {group.rows.map((row, index) => (
          <View
            key={row.id}
            style={{
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <AnimatedPressable
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={row.label}
              onPress={() => {
                void haptics.selection();
                onPressFabric(row);
              }}
            >
              <FabricRowBody
                row={row}
                embedded
                disclose
                showOrder={false}
                showSupplier={showSupplier}
                surface={surface}
              />
            </AnimatedPressable>
          </View>
        ))}
      </View>
    </View>
  );
}
