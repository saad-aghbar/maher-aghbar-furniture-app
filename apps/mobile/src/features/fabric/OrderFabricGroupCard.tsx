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
import {
  fabricAwaitsSupply,
  fabricOrderShowsSubOrders,
  fabricRemainingNeed,
  fabricStockCoverage,
  type FabricOrderGroup,
  type FabricStatusSurface,
  type FabricSubOrderGroup,
  type FabricTrackerRow,
} from './selectFabricTracker';

type Props = {
  group: FabricOrderGroup;
  onPressOrder?: () => void;
  onPressSubOrder?: (sub: FabricSubOrderGroup) => void;
  onPressFabric: (row: FabricTrackerRow) => void;
  surface?: FabricStatusSurface;
  /** Purchasing shows supplier on child rows. */
  showSupplier?: boolean;
  index?: number;
  /** Free general-stock qty keyed by inventory item id. */
  stockFreeByItemId?: Record<string, number>;
};

/**
 * ORDER is the parent. Factory sub-orders (SO-xxx.A) nest under it.
 * Fabrics hang off the sub-order, never off every line of the sales order.
 */
export function OrderFabricGroupCard({
  group,
  onPressOrder,
  onPressSubOrder,
  onPressFabric,
  surface = 'desk',
  showSupplier = false,
  stockFreeByItemId,
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
  const nested = fabricOrderShowsSubOrders(group);

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
            alignItems: nested ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          {group.orderNumber ? (
            <View style={{ flex: 1, gap: 2 }}>
              {nested ? (
                <AppText
                  variant="caption"
                  weight={titleWeight}
                  style={{
                    color: colors.brand,
                    letterSpacing: locale === 'ar' ? 0 : 0.5,
                    textTransform: locale === 'ar' ? 'none' : 'uppercase',
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {t('mobile.inventory.fabricSalesOrderEyebrow')}
                </AppText>
              ) : null}
              <AppText
                variant="label"
                weight={titleWeight}
                dir="ltr"
                style={{ flexShrink: 1, fontSize: 16, color: colors.brand, textAlign: isRTL ? 'right' : 'left' }}
              >
                {group.orderNumber}
              </AppText>
            </View>
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
          {!nested ? (
            <ProductThumb uri={group.productImageUrl} size={56} radius={theme.radius.lg} />
          ) : null}
          <View style={{ flex: 1, gap: 2 }}>
            {!nested && group.productName ? (
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
            {nested ? (
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('mobile.inventory.fabricSubOrdersCount', { n: group.subOrders.length })}
              </AppText>
            ) : null}
            {showSupplier && group.purchaseOrderNumber ? (
              <AppText variant="caption" dir="ltr" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('mobile.purchasing.fabricPoNumber')} {group.purchaseOrderNumber}
              </AppText>
            ) : null}
            {showSupplier && group.supplierInvoiceNumber ? (
              <AppText variant="caption" dir="ltr" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('mobile.purchasing.fabricInvoice')} {group.supplierInvoiceNumber}
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
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        {nested ? (
          group.subOrders.map((sub) => (
            <SubOrderBlock
              key={sub.id}
              sub={sub}
              onPressSubOrder={onPressSubOrder}
              onPressFabric={onPressFabric}
              showSupplier={showSupplier}
              surface={surface}
              stockFreeByItemId={stockFreeByItemId}
            />
          ))
        ) : (
          <>
            <AppText
              variant="caption"
              weight={titleWeight}
              style={{
                color: colors.brand,
                letterSpacing: locale === 'ar' ? 0 : 0.5,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('mobile.inventory.fabricChildrenEyebrow')}
            </AppText>
            <FabricChildList
              rows={group.rows}
              onPressFabric={onPressFabric}
              showSupplier={showSupplier}
              surface={surface}
              stockFreeByItemId={stockFreeByItemId}
            />
          </>
        )}
      </View>
    </View>
  );
}

function SubOrderBlock({
  sub,
  onPressSubOrder,
  onPressFabric,
  showSupplier,
  surface,
  stockFreeByItemId,
}: {
  sub: FabricSubOrderGroup;
  onPressSubOrder?: (sub: FabricSubOrderGroup) => void;
  onPressFabric: (row: FabricTrackerRow) => void;
  showSupplier: boolean;
  surface: FabricStatusSurface;
  stockFreeByItemId?: Record<string, number>;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const readyLabel = t('mobile.purchasing.fabricReadyCount', {
    ready: sub.readyCount,
    required: sub.requiredCount,
  });
  const number = sub.productionOrderNumber;
  const open = Boolean(onPressSubOrder && sub.productionOrderId);

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
        overflow: 'hidden',
      }}
    >
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${number ?? ''} ${sub.productName ?? ''} ${readyLabel}`.trim()}
        disabled={!open}
        onPress={() => {
          if (!open || !onPressSubOrder) return;
          void haptics.selection();
          onPressSubOrder(sub);
        }}
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          gap: 2,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
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
          <AppText
            variant="caption"
            weight={titleWeight}
            style={{
              color: colors.brand,
              letterSpacing: locale === 'ar' ? 0 : 0.5,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
            }}
          >
            {t('mobile.inventory.fabricSubOrderEyebrow')}
          </AppText>
          <AppText
            variant="caption"
            dir="ltr"
            style={{ color: sub.attention ? colors.warning : colors.textMuted }}
          >
            {readyLabel}
          </AppText>
        </View>
        {number ? (
          <AppText
            variant="label"
            weight={titleWeight}
            dir="ltr"
            style={{ color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }}
          >
            {number}
          </AppText>
        ) : null}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            marginTop: 2,
          }}
        >
          <ProductThumb uri={sub.productImageUrl} size={44} radius={theme.radius.md} />
          {sub.productName ? (
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={2}
              style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
            >
              {sub.productName}
            </AppText>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {open ? (
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={14}
              color={colors.textMuted}
            />
          ) : null}
        </View>
      </AnimatedPressable>
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        <FabricChildList
          rows={sub.rows}
          onPressFabric={onPressFabric}
          showSupplier={showSupplier}
          surface={surface}
          stockFreeByItemId={stockFreeByItemId}
        />
      </View>
    </View>
  );
}

function FabricChildList({
  rows,
  onPressFabric,
  showSupplier,
  surface,
  stockFreeByItemId,
}: {
  rows: FabricTrackerRow[];
  onPressFabric: (row: FabricTrackerRow) => void;
  showSupplier: boolean;
  surface: FabricStatusSurface;
  stockFreeByItemId?: Record<string, number>;
}) {
  const { colors } = useTheme();
  const { t } = useLocale();
  return (
    <>
      {rows.map((row, index) => (
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
              stockHint={stockHintForRow(row, stockFreeByItemId, t)}
            />
          </AnimatedPressable>
        </View>
      ))}
    </>
  );
}

function stockHintForRow(
  row: FabricTrackerRow,
  freeById: Record<string, number> | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string | null {
  if (!freeById || !fabricAwaitsSupply(row) || !row.inventoryItemId) return null;
  const free = freeById[row.inventoryItemId] ?? 0;
  if (!(free > 0)) return null;
  const need = fabricRemainingNeed(row);
  const cover = fabricStockCoverage({ need, free });
  if (cover === 'partial' && need != null) {
    return t('mobile.inventory.fabricCoversPartial', { free, need, unit: row.unit });
  }
  return t('mobile.inventory.fabricInGeneralStock');
}
