import { ScrollView, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryItem } from '../api';
import { useInventoryOpenReceiptsQuery, useMaterialDemandQuery } from '../query';
import {
  formatInventoryMaterialType,
  selectInventoryItemCard,
} from '../selectInventory';
import { InventorySkuThumb } from './InventorySkuThumb';
import { InventorySheetFooter } from './InventorySheetFooter';
import { InventoryBoardCard, InventoryQtyStrip } from './InventoryBoardCard';
import { WarehouseBinPlace } from './WarehouseBinBoard';

type Props = {
  open: boolean;
  item: InventoryItem | 'not-found' | null;
  onClose: () => void;
  onClosed?: () => void;
  onScanAgain: () => void;
  onReceive?: (item: InventoryItem) => void;
  onIssue?: (item: InventoryItem) => void;
  onTransfer?: (item: InventoryItem) => void;
  onCount?: (item: InventoryItem) => void;
  onViewDetails?: (item: InventoryItem) => void;
  onQrCode?: (item: InventoryItem) => void;
  /** Queue PO navigation via host handoff — never navigate while this Modal is open. */
  onOpenPurchaseOrder?: (purchaseOrderId: string) => void;
};

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Identify-only scan result. Never posts a stock movement.
 * Destination sheets must open only after this Modal's onClosed (host handoff).
 */
export function InventoryScanResultSheet({
  open,
  item,
  onClose,
  onClosed,
  onScanAgain,
  onReceive,
  onIssue,
  onTransfer,
  onCount,
  onViewDetails,
  onQrCode,
  onOpenPurchaseOrder,
}: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL, formatDate } = useLocale();
  const { theme, colors } = useTheme();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const notFound = item === 'not-found';
  const found = item && item !== 'not-found' ? item : null;
  const card = found ? selectInventoryItemCard(found, locale) : null;
  const mutable = Boolean(card?.isActive && !card.archivedAt);
  const isFinishedGood = found?.itemClass === 'FINISHED_GOOD';
  const canReceive = can(user, 'inventory.receive') && !isFinishedGood;
  const canIssue = can(user, 'inventory.issue') && !isFinishedGood;
  const canTransfer = can(user, 'inventory.transfer');
  const canCount = can(user, 'inventory.count');
  const canReadPo = can(user, 'purchase-order.read');

  const receiptsQuery = useInventoryOpenReceiptsQuery(
    found?.id,
    open && Boolean(found) && canReceive,
  );
  const demandQuery = useMaterialDemandQuery(open && Boolean(found) && canReadPo);
  const receipts = receiptsQuery.data ?? [];
  const demand = (demandQuery.data ?? []).find(
    (row) => row.inventoryItemId === found?.id || row.sku === found?.sku,
  );
  const materialTypeLabel = formatInventoryMaterialType(card?.materialType, t);

  const hasExtra =
    (card?.balances.length ?? 0) > 1 ||
    (canReceive && receipts.length > 0) ||
    Boolean(canReadPo && demand);
  const sheetHeight = Math.round(height * (hasExtra ? 0.88 : 0.72));

  if (notFound) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        onClosed={onClosed}
        title={t('mobile.inventory.itemNotFound')}
        fitContent
        maxHeight={Math.round(height * 0.45)}
      >
        <View style={{ gap: theme.spacing.md }}>
          <InventoryBoardCard accent={colors.warning}>
            <AppText variant="body" color="muted">
              {t('mobile.inventory.lookupFailed')}
            </AppText>
          </InventoryBoardCard>
          <InventorySheetFooter
            primaryLabel={t('mobile.inventory.scanAgain')}
            onPrimary={onScanAgain}
            secondaryLabel={t('mobile.inventory.done')}
            onSecondary={onClose}
          />
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open && Boolean(found)}
      onClose={onClose}
      onClosed={onClosed}
      title={t('mobile.inventory.itemIdentified')}
      sheetHeight={sheetHeight}
    >
      {card && found ? (
        <View style={{ flex: 1, gap: theme.spacing.md }}>
          <ScrollView
            contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.sm }}
            showsVerticalScrollIndicator={false}
          >
            <InventoryBoardCard>
              <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
              <InventorySkuThumb uri={card.imageUrl} size={112} />
              <AppText
                variant="title"
                weight={titleWeight}
                style={{ textAlign: 'center' }}
                accessibilityRole="header"
              >
                {card.name}
              </AppText>
              <AppText variant="caption" color="muted" dir="ltr" style={{ textAlign: 'center' }}>
                {card.sku}
              </AppText>
              {materialTypeLabel ? (
                <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                  {materialTypeLabel}
                </AppText>
              ) : null}
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <StatusBadge
                  status={card.isActive ? 'ACTIVE' : 'CANCELLED'}
                  label={
                    card.isActive
                      ? t('mobile.inventory.inStock')
                      : t('mobile.inventory.inactiveMaterial')
                  }
                  dot
                />
                <AppText variant="caption" color="muted" dir="ltr">
                  {t('mobile.inventory.unit')}: {card.unit}
                </AppText>
              </View>
              </View>
            </InventoryBoardCard>

            <InventoryQtyStrip
              onHand={card.onHand}
              reserved={card.reservedQty}
              available={card.freeQty}
              emphasizeAvailable
            />

            {/* Warehouses */}
            {card.balances.length > 0 ? (
              <InventoryBoardCard
                title={t('mobile.inventory.warehousesSection')}
                titleWeight={titleWeight}
              >
                {card.balances.map((row, idx) => (
                  <View
                    key={`${row.warehouseId}-${row.locationId ?? idx}`}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      paddingVertical: theme.spacing.xs,
                      borderBottomWidth: idx === card.balances.length - 1 ? 0 : 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <WarehouseBinPlace
                        warehouseName={row.warehouseName}
                        binLabel={row.locationName}
                      />
                    </View>
                    <AppText variant="body" weight={titleWeight} dir="ltr">
                      {row.quantityLabel}
                    </AppText>
                  </View>
                ))}
              </InventoryBoardCard>
            ) : null}

            {/* Incoming */}
            {canReceive ? (
              <InventoryBoardCard
                title={t('mobile.inventory.incoming')}
                titleWeight={titleWeight}
              >
                {receipts.length === 0 ? (
                  <AppText variant="caption" color="muted">
                    {t('mobile.inventory.noIncomingSupply')}
                  </AppText>
                ) : (
                  receipts.map((row) => {
                    const supplier =
                      locale === 'ar'
                        ? row.supplierNameAr || row.supplierName
                        : locale === 'he'
                          ? row.supplierNameHe || row.supplierName
                          : row.supplierName;
                    const expected = row.expectedDeliveryDate
                      ? formatDate(row.expectedDeliveryDate)
                      : null;
                    const body = (
                      <View
                        style={{
                          borderWidth: 1,
                          borderColor: colors.borderStrong,
                          borderRadius: theme.radius.lg,
                          padding: theme.spacing.md,
                          gap: theme.spacing.xs,
                          backgroundColor: colors.surfaceSecondary,
                        }}
                      >
                        <AppText variant="body" weight={titleWeight}>
                          {row.purchaseOrderNumber}
                        </AppText>
                        <AppText variant="caption" color="muted">
                          {supplier}
                        </AppText>
                        <AppText variant="caption" color="muted" dir="ltr">
                          {formatQty(Number(row.remainingQty))} {row.unit}
                          {expected ? ` · ${expected}` : ''}
                        </AppText>
                      </View>
                    );
                    if (!canReadPo || !onOpenPurchaseOrder) {
                      return <View key={row.purchaseOrderId}>{body}</View>;
                    }
                    return (
                      <AnimatedPressable
                        key={row.purchaseOrderId}
                        variant="card"
                        accessibilityRole="button"
                        onPress={() => {
                          void haptics.selection();
                          onOpenPurchaseOrder(row.purchaseOrderId);
                        }}
                      >
                        {body}
                      </AnimatedPressable>
                    );
                  })
                )}
              </InventoryBoardCard>
            ) : null}

            {canReadPo && demand ? (
              <View style={{ gap: theme.spacing.xs }}>
                {demand.nextRequiredBy ? (
                  <AppText variant="caption" color="muted">
                    {t('mobile.inventory.requiredBy')}: {formatDate(demand.nextRequiredBy)}
                  </AppText>
                ) : null}
                {demand.affected?.length ? (
                  <AppText variant="caption" color="muted">
                    {t('mobile.inventory.affectedProduction', {
                      count: demand.affected.length,
                    })}
                  </AppText>
                ) : null}
                {demand.status ? (
                  <AppText variant="caption" color="muted">
                    {demand.status}
                  </AppText>
                ) : null}
              </View>
            ) : null}

            {/* Warehouse ops stay in the scroll; Receive/Issue/QR pin above the footer. */}
            {(mutable && (canTransfer || canCount)) || onViewDetails ? (
              <View style={{ gap: theme.spacing.md }}>
                {mutable && (canTransfer || canCount) ? (
                  <View style={{ gap: theme.spacing.xs }}>
                    <AppText variant="caption" color="muted" weight={titleWeight}>
                      {t('mobile.inventory.warehouseOps')}
                    </AppText>
                    {canTransfer && onTransfer ? (
                      <ActionRow
                        icon="swap-horizontal-outline"
                        label={t('mobile.inventory.transfer')}
                        accessibilityLabel={t('mobile.inventory.a11yTransfer', {
                          name: card.name,
                        })}
                        onPress={() => onTransfer(found)}
                      />
                    ) : null}
                    {canCount && onCount ? (
                      <ActionRow
                        icon="clipboard-outline"
                        label={t('mobile.inventory.count')}
                        accessibilityLabel={t('mobile.inventory.a11yCount', {
                          name: card.name,
                        })}
                        onPress={() => onCount(found)}
                      />
                    ) : null}
                  </View>
                ) : null}

                {onViewDetails ? (
                  <View style={{ gap: theme.spacing.xs }}>
                    <AppText variant="caption" color="muted" weight={titleWeight}>
                      {t('mobile.inventory.itemSection')}
                    </AppText>
                    <ActionRow
                      icon="document-text-outline"
                      label={t('mobile.inventory.viewDetails')}
                      chevron
                      accessibilityLabel={t('mobile.inventory.a11yViewDetails', {
                        name: card.name,
                      })}
                      onPress={() => onViewDetails(found)}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          {mutable && (canReceive || canIssue) ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              {canReceive && onReceive ? (
                <PrimaryAction
                  label={t('mobile.inventory.receive')}
                  icon="arrow-down-outline"
                  accessibilityLabel={t('mobile.inventory.a11yReceive', {
                    name: card.name,
                  })}
                  onPress={() => onReceive(found)}
                />
              ) : null}
              {canIssue && onIssue ? (
                <PrimaryAction
                  label={t('mobile.inventory.issue')}
                  icon="arrow-up-outline"
                  accessibilityLabel={t('mobile.inventory.a11yIssue', {
                    name: card.name,
                  })}
                  onPress={() => onIssue(found)}
                />
              ) : null}
            </View>
          ) : null}

          {onQrCode ? (
            <ActionRow
              icon="qr-code-outline"
              label={t('mobile.inventory.qrCode')}
              chevron
              accessibilityLabel={t('mobile.inventory.a11yShowQr', {
                name: card.name,
              })}
              onPress={() => onQrCode(found)}
            />
          ) : null}

          <InventorySheetFooter
            primaryLabel={t('mobile.inventory.scanAgain')}
            onPrimary={onScanAgain}
            secondaryLabel={t('mobile.inventory.done')}
            onSecondary={onClose}
          />
        </View>
      ) : null}
    </BottomSheet>
  );
}

function PrimaryAction({
  label,
  icon,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flex: 1,
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.full,
        backgroundColor: colors.brand,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
      }}
    >
      <Ionicons name={icon} size={18} color={colors.onBrand} />
      <AppText variant="label" weight={titleWeight} style={{ color: colors.onBrand }}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  chevron,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  chevron?: boolean;
  accessibilityLabel: string;
}) {
  const { colors, theme } = useTheme();
  const { isRTL, locale } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
      }}
    >
      <Ionicons name={icon} size={20} color={colors.brand} />
      <AppText variant="body" weight={titleWeight} style={{ flex: 1 }}>
        {label}
      </AppText>
      {chevron ? (
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      ) : null}
    </AnimatedPressable>
  );
}
