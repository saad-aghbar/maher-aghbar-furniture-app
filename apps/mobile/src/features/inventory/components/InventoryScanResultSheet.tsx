import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryItem } from '../api';
import { useInventoryOpenReceiptsQuery, useMaterialDemandQuery } from '../query';
import {
  formatInventoryMaterialType,
  selectInventoryItemCard,
} from '../selectInventory';
import { InventorySkuThumb } from './InventorySkuThumb';
import { InventorySheetFooter } from './InventorySheetFooter';

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
          <AppText variant="body" color="muted">
            {t('mobile.inventory.lookupFailed')}
          </AppText>
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
            {/* Hero */}
            <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
              <InventorySkuThumb uri={card.imageUrl} size={112} />
              <AppText
                variant="title"
                weight="semibold"
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

            {/* Stock */}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              <StatCell
                label={t('mobile.inventory.onHand')}
                value={`${formatQty(card.onHand)} ${card.unit}`}
              />
              <StatCell
                label={t('mobile.inventory.reservedLabel')}
                value={`${formatQty(card.reservedQty)} ${card.unit}`}
              />
              <StatCell
                label={t('mobile.inventory.available')}
                value={`${formatQty(card.freeQty)} ${card.unit}`}
              />
            </View>

            {/* Warehouses */}
            {card.balances.length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="caption" color="muted" weight="semibold">
                  {t('mobile.inventory.warehousesSection')}
                </AppText>
                {card.balances.map((row) => (
                  <View
                    key={row.warehouseId}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: theme.spacing.xs,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <AppText variant="body" style={{ flex: 1 }}>
                      {row.warehouseName}
                    </AppText>
                    <AppText variant="body" weight="semibold" dir="ltr">
                      {row.quantityLabel}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Incoming */}
            {canReceive ? (
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="caption" color="muted" weight="semibold">
                  {t('mobile.inventory.incoming')}
                </AppText>
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
                        <AppText variant="body" weight="semibold">
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
                      <Pressable
                        key={row.purchaseOrderId}
                        accessibilityRole="button"
                        onPress={() => {
                          void haptics.selection();
                          onOpenPurchaseOrder(row.purchaseOrderId);
                        }}
                      >
                        {body}
                      </Pressable>
                    );
                  })
                )}
              </View>
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

            {/* Actions */}
            {(mutable && (canReceive || canIssue || canTransfer || canCount)) ||
            onViewDetails ||
            onQrCode ? (
              <View style={{ gap: theme.spacing.md }}>
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

                {mutable && (canTransfer || canCount) ? (
                  <View style={{ gap: theme.spacing.xs }}>
                    <AppText variant="caption" color="muted" weight="semibold">
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

                {onViewDetails || onQrCode ? (
                  <View style={{ gap: theme.spacing.xs }}>
                    <AppText variant="caption" color="muted" weight="semibold">
                      {t('mobile.inventory.itemSection')}
                    </AppText>
                    {onViewDetails ? (
                      <ActionRow
                        icon="document-text-outline"
                        label={t('mobile.inventory.viewDetails')}
                        chevron
                        accessibilityLabel={t('mobile.inventory.a11yViewDetails', {
                          name: card.name,
                        })}
                        onPress={() => onViewDetails(found)}
                      />
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
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

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

function StatCell({ label, value }: { label: string; value: string }) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xs,
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        gap: 2,
      }}
    >
      <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
        {label}
      </AppText>
      <AppText variant="body" weight="semibold" dir="ltr" style={{ textAlign: 'center' }}>
        {value}
      </AppText>
    </View>
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
  const { colors, theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flex: 1,
        minHeight: 48,
        borderRadius: theme.radius.xl,
        backgroundColor: colors.brand,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
      }}
    >
      <Ionicons name={icon} size={18} color={colors.onBrand} />
      <AppText variant="body" weight="semibold" style={{ color: colors.onBrand }}>
        {label}
      </AppText>
    </Pressable>
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
  const { isRTL } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 44,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Ionicons name={icon} size={20} color={colors.brand} />
      <AppText variant="body" weight="medium" style={{ flex: 1 }}>
        {label}
      </AppText>
      {chevron ? (
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      ) : null}
    </Pressable>
  );
}
