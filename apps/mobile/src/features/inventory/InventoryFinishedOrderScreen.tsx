import { useMemo, useState, type ReactNode } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import type { FinishedLot, InventoryItem, Warehouse } from './api';
import { getInventoryItem } from './api';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useDeliveryLoadSheetQuery } from '@/features/delivery-load/query';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { fgLeaveByLabel, fgLeaveUrgency } from './fgFilters';
import {
  flattenFinishedLotsPages,
  useCreateInventoryStockCountMutation,
  useCreateWarehouseTransferMutation,
  useCompleteWarehouseTransferMutation,
  useFinishedLotsInfiniteQuery,
  useWarehousesQuery,
} from './query';
import { selectFinishedOrders } from './selectFinishedOrders';
import { warehousesForLifecycle } from './preferWarehouseForReceive';
import { transferableQty } from './selectInventoryPick';
import { CreateStockCountSheet } from './components/CreateStockCountSheet';
import { CreateTransferSheet } from './components/CreateTransferSheet';
import { InventoryListSkeleton } from './components/InventorySkeleton';

const BACK_SLOT = 44;

/** When balances lag behind FG lots (common for order-reserved stock), seed on-hand from the lot. */
function withLotBalanceHint(
  item: InventoryItem,
  lot: FinishedLot | undefined,
): InventoryItem {
  if (!lot?.warehouse?.id) return item;
  const warehouseId = lot.warehouse.id;
  const lotQty = Number(lot.quantity) || 0;
  if (!(lotQty > 0)) return item;
  if (transferableQty(item, warehouseId) >= lotQty) return item;
  const reserved = lot.status === 'RESERVED' ? lotQty : 0;
  const balances = [...(item.balances ?? [])].filter((b) => b.warehouseId !== warehouseId);
  balances.push({
    id: `lot-hint-${lot.id}`,
    warehouseId,
    availableQty: lotQty,
    onHandQty: lotQty,
    reservedQty: reserved,
    freeQty: Math.max(0, lotQty - reserved),
  });
  return {
    ...item,
    balances,
    onHandQty: (Number(item.onHandQty) || 0) + lotQty,
    reservedQty: (Number(item.reservedQty) || 0) + reserved,
    freeQty: Math.max(0, (Number(item.freeQty) || 0) + (lotQty - reserved)),
  };
}

type PackageRow = {
  key: string;
  title: string;
  subtitle?: string;
  checked: boolean;
  warehouseLabel?: string | null;
};

function FloorCard({ children }: { children: ReactNode }) {
  const { colors, theme, colorScheme } = useTheme();
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
      {children}
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  const { isRTL, locale } = useLocale();
  return (
    <AppText
      variant="body"
      weight={locale === 'ar' ? 'medium' : 'semibold'}
      style={{ textAlign: isRTL ? 'right' : 'left', marginBottom: 4 }}
    >
      {children}
    </AppText>
  );
}

function FactRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm + 2,
        paddingHorizontal: theme.spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={icon} size={15} color={colors.brand} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {label}
        </AppText>
        <AppText
          variant="bodySecondary"
          weight="medium"
          numberOfLines={2}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {value}
        </AppText>
      </View>
    </View>
  );
}

function PackageListRow({
  row,
  index,
  total,
}: {
  row: PackageRow;
  index: number;
  total: number;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        borderBottomWidth: index < total - 1 ? 1 : 0,
        borderBottomColor: colors.border,
        backgroundColor: row.checked ? colors.brandSoft : colors.surface,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="cube-outline" size={16} color={colors.brand} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText
          weight="semibold"
          numberOfLines={2}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {row.title}
        </AppText>
        <AppText
          variant="caption"
          color="muted"
          numberOfLines={1}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {row.subtitle ||
            (row.checked
              ? t('mobile.inventory.fgPackageChecked')
              : t('mobile.inventory.fgPackageWaiting'))}
        </AppText>
      </View>
      <View
        accessibilityRole="text"
        accessibilityLabel={
          row.checked
            ? t('mobile.inventory.fgPackageChecked')
            : t('mobile.inventory.fgPackageWaiting')
        }
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: row.checked ? colors.brand : colors.surface,
          borderWidth: 1.5,
          borderColor: row.checked ? colors.brand : colors.borderStrong,
        }}
      >
        <Ionicons
          name={row.checked ? 'checkmark' : 'ellipse-outline'}
          size={row.checked ? 18 : 16}
          color={row.checked ? colors.onBrand : colors.textMuted}
        />
      </View>
    </View>
  );
}

function ActionRow({
  label,
  icon,
  onPress,
  last,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  last?: boolean;
  disabled?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min + 8,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md + 2,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={icon} size={18} color={colors.brand} />
      </View>
      <AppText
        weight="semibold"
        style={{ flex: 1, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
      <Ionicons
        name={isRTL ? 'chevron-back' : 'chevron-forward'}
        size={16}
        color={colors.textMuted}
      />
    </AnimatedPressable>
  );
}

/**
 * Order-centric Finished Goods desk — floor cards, package list, working actions.
 */
export function InventoryFinishedOrderScreen() {
  const { salesOrderId: soParam } = useLocalSearchParams<{ salesOrderId: string }>();
  const salesOrderId = String(soParam ?? '');
  const { t, locale, isRTL, formatDateTime } = useLocale();
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const allowed = can(user, 'inventory.read');
  const canTransfer = can(user, 'inventory.transfer');
  const canCount = can(user, 'inventory.count');
  const canDelivery = can(user, 'delivery.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [opsMode, setOpsMode] = useState<'transfer' | 'count' | null>(null);
  const [opsItem, setOpsItem] = useState<InventoryItem | null>(null);
  const [opsFromWarehouseId, setOpsFromWarehouseId] = useState<string | null>(null);
  const [opsQty, setOpsQty] = useState<number | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);

  const fgQuery = useFinishedLotsInfiniteQuery(
    { scope: 'inWarehouse', pageSize: 100 },
    allowed && Boolean(salesOrderId),
  );
  const historyQuery = useFinishedLotsInfiniteQuery(
    { scope: 'history', pageSize: 100 },
    allowed && Boolean(salesOrderId),
  );

  const lots = useMemo(() => {
    const live = flattenFinishedLotsPages(fgQuery.data);
    const hist = flattenFinishedLotsPages(historyQuery.data);
    const byId = new Map<string, FinishedLot>();
    for (const lot of [...live, ...hist]) {
      if (lot.salesOrder?.id === salesOrderId || lot.salesOrderNumber === salesOrderId) {
        byId.set(lot.id, lot);
      }
    }
    return [...byId.values()];
  }, [fgQuery.data, historyQuery.data, salesOrderId]);

  const order = useMemo(() => {
    const groups = selectFinishedOrders(lots, { scope: 'inWarehouse', fgFilter: 'all' });
    if (groups[0]) return groups[0];
    return selectFinishedOrders(lots, { scope: 'history' })[0] ?? null;
  }, [lots]);

  const deliveryId = order?.deliveryId ?? null;
  const loadQuery = useDeliveryLoadSheetQuery(
    deliveryId,
    allowed && canDelivery && Boolean(deliveryId),
  );

  const warehousesQuery = useWarehousesQuery(
    allowed && (opsMode === 'transfer' || opsMode === 'count'),
  );
  const createTransferMutation = useCreateWarehouseTransferMutation();
  const completeTransferMutation = useCompleteWarehouseTransferMutation();
  const createCountMutation = useCreateInventoryStockCountMutation();

  const fgWarehouses = useMemo(
    () => warehousesForLifecycle((warehousesQuery.data ?? []) as Warehouse[], 'finished'),
    [warehousesQuery.data],
  );

  const orderTransferQty = useMemo(() => {
    if (!order?.lots.length) return 0;
    return order.lots.reduce((sum, lot) => sum + (Number(lot.quantity) || 0), 0);
  }, [order]);

  const productName = order
    ? locale === 'ar'
      ? order.productNameAr || order.productNameEn
      : locale === 'he'
        ? order.productNameHe || order.productNameEn
        : order.productNameEn || order.productNameAr
    : '';
  const dealer = order
    ? locale === 'ar'
      ? order.dealerNameAr || order.dealerNameEn || '—'
      : locale === 'he'
        ? order.dealerNameHe || order.dealerNameEn || '—'
        : order.dealerNameEn || order.dealerNameAr || '—'
    : '';

  const leaveLabel = order
    ? fgLeaveByLabel(
        { deliveryStatus: order.deliveryStatus, deliveryDate: order.deliveryDate },
        t,
      )
    : '';
  const urgency = order
    ? fgLeaveUrgency({
        deliveryStatus: order.deliveryStatus,
        deliveryDate: order.deliveryDate,
      })
    : 'waitingForTruck';
  const leaveColor =
    urgency === 'overdue'
      ? colors.error
      : urgency === 'leavingToday'
        ? colors.warning
        : colors.brand;

  const packages: PackageRow[] = useMemo(() => {
    const sheet = loadQuery.data;
    if (sheet?.products?.length) {
      const rows: PackageRow[] = [];
      for (const product of sheet.products) {
        const wh =
          locale === 'ar'
            ? product.warehouse?.nameAr || product.warehouse?.nameEn
            : product.warehouse?.nameEn || product.warehouse?.nameAr;
        for (const piece of product.pieces ?? []) {
          const named =
            locale === 'ar'
              ? piece.nameAr || piece.nameEn || piece.label
              : locale === 'he'
                ? piece.nameHe || piece.nameEn || piece.label
                : piece.nameEn || piece.nameAr || piece.label;
          rows.push({
            key: piece.id,
            title: named || t('mobile.deliveryLoad.packageOf', {
              index: piece.pieceIndex,
              total: product.pieces.length,
            }),
            subtitle: wh || undefined,
            checked: Boolean(piece.loadedAt),
            warehouseLabel: wh,
          });
        }
      }
      if (rows.length) return rows;
    }

    if (order?.pieceLabels?.length) {
      return order.pieceLabels.map((p, i) => {
        const title =
          locale === 'ar'
            ? p.nameAr || p.nameEn
            : locale === 'he'
              ? p.nameHe || p.nameEn
              : p.nameEn || p.nameAr;
        return {
          key: `label-${i}`,
          title: title || t('mobile.inventory.fgPackageN', { n: i + 1 }),
          checked: i < (order.loadChecked || 0),
        };
      });
    }

    const count = Math.max(1, order?.packageCount || 0);
    return Array.from({ length: count }, (_, i) => ({
      key: `pkg-${i}`,
      title: t('mobile.inventory.fgPackageN', { n: i + 1 }),
      checked: i < (order?.loadChecked || 0),
    }));
  }, [loadQuery.data, order, locale, t]);

  const lotsByWarehouse = useMemo(() => {
    const map = new Map<string, { label: string; lots: FinishedLot[] }>();
    for (const lot of lots) {
      const id = lot.warehouse?.id ?? 'unknown';
      const label =
        locale === 'ar'
          ? lot.warehouse?.nameAr || lot.warehouse?.code || id
          : lot.warehouse?.nameEn || lot.warehouse?.code || id;
      const cur = map.get(id) ?? { label, lots: [] };
      cur.lots.push(lot);
      map.set(id, cur);
    }
    return [...map.values()];
  }, [lots, locale]);

  const loading =
    (fgQuery.isPending && !fgQuery.data) ||
    (historyQuery.isPending && !historyQuery.data);
  const error =
    (fgQuery.isError && !fgQuery.data) || (historyQuery.isError && !historyQuery.data);

  async function openOps(mode: 'transfer' | 'count') {
    const lot = order?.lots[0];
    const itemId = lot?.inventoryItem.id;
    if (!itemId) return;
    setOpsLoading(true);
    try {
      const item = await getInventoryItem(itemId);
      const withHint = withLotBalanceHint(item, lot);
      // Sum all lots in the same warehouse for this order when balances lag.
      let enriched = withHint;
      if (order?.lots.length) {
        const byWh = new Map<string, { qty: number; reserved: number }>();
        for (const row of order.lots) {
          const whId = row.warehouse?.id;
          if (!whId) continue;
          const q = Number(row.quantity) || 0;
          const cur = byWh.get(whId) ?? { qty: 0, reserved: 0 };
          cur.qty += q;
          if (row.status === 'RESERVED') cur.reserved += q;
          byWh.set(whId, cur);
        }
        const balances = [...(enriched.balances ?? [])];
        for (const [whId, agg] of byWh) {
          if (transferableQty(enriched, whId) >= agg.qty) continue;
          const without = balances.filter((b) => b.warehouseId !== whId);
          without.push({
            id: `lot-hint-wh-${whId}`,
            warehouseId: whId,
            availableQty: agg.qty,
            onHandQty: agg.qty,
            reservedQty: agg.reserved,
            freeQty: Math.max(0, agg.qty - agg.reserved),
          });
          balances.length = 0;
          balances.push(...without);
        }
        enriched = { ...enriched, balances };
      }
      setOpsItem(enriched);
      setOpsFromWarehouseId(lot?.warehouse?.id ?? null);
      setOpsQty(mode === 'transfer' ? orderTransferQty || Number(lot?.quantity) || 1 : null);
      setOpsMode(mode);
    } catch {
      void haptics.error();
      showToast({
        variant: 'error',
        message: t('mobile.inventory.errorBody'),
      });
    } finally {
      setOpsLoading(false);
    }
  }

  function closeOps() {
    setOpsMode(null);
    setOpsItem(null);
    setOpsFromWarehouseId(null);
    setOpsQty(null);
  }

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  const checkedCount = packages.filter((p) => p.checked).length;

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          paddingBottom: theme.spacing.sm,
          minHeight: BACK_SLOT,
        }}
      >
        <View style={{ width: BACK_SLOT }}>
          <ScreenBackLead fallback={'/(app)/(admin)/(tabs)/inventory' as Href} />
        </View>
        <AppText
          variant="body"
          weight={titleWeight}
          numberOfLines={1}
          style={{ flex: 1, textAlign: 'center' }}
        >
          {order?.salesOrderNumber || t('mobile.inventory.fgOrderDetail')}
        </AppText>
        <View style={{ width: BACK_SLOT }} />
      </View>

      {loading ? (
        <InventoryListSkeleton />
      ) : error ? (
        <ErrorState
          title={t('mobile.inventory.errorTitle')}
          description={t('mobile.inventory.errorBody')}
          retryLabel={t('mobile.inventory.retry')}
          onRetry={() => {
            void fgQuery.refetch();
            void historyQuery.refetch();
          }}
        />
      ) : !order ? (
        <EmptyState
          title={t('mobile.inventory.fgOrderMissing')}
          description={t('mobile.inventory.emptyFinishedBody')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
          }}
          refreshControl={
            <RefreshControl
              refreshing={
                fgQuery.isRefetching || historyQuery.isRefetching || loadQuery.isRefetching
              }
              onRefresh={() => {
                void fgQuery.refetch();
                void historyQuery.refetch();
                void loadQuery.refetch();
              }}
            />
          }
        >
          {/* Hero */}
          <FloorCard>
            <View
              style={{
                width: '100%',
                aspectRatio: 1.35,
                backgroundColor: colors.surfaceSecondary,
              }}
            >
              {resolveOrderMediaUri(order.productImageUrl) ? (
                <Image
                  source={{ uri: resolveOrderMediaUri(order.productImageUrl)! }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
                </View>
              )}
            </View>
            <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
              <AppText weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {order.projectName || productName}
              </AppText>
              <AppText color="secondary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {dealer}
              </AppText>
              <View
                style={{
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: theme.radius.full,
                  backgroundColor: colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: leaveColor,
                }}
              >
                <Ionicons
                  name={urgency === 'overdue' ? 'alert-circle' : 'time-outline'}
                  size={14}
                  color={leaveColor}
                />
                <AppText variant="caption" weight="semibold" style={{ color: leaveColor }}>
                  {leaveLabel}
                </AppText>
              </View>
            </View>
          </FloorCard>

          {/* Order facts */}
          <View style={{ gap: theme.spacing.xs }}>
            <SectionTitle>{t('mobile.inventory.fgOrderFacts')}</SectionTitle>
            <FloorCard>
              <FactRow
                icon="document-text-outline"
                label={t('mobile.inventory.fgSalesOrder')}
                value={order.salesOrderNumber}
              />
              {order.productionOrderNumbers.length ? (
                <FactRow
                  icon="construct-outline"
                  label={t('mobile.inventory.fgProductionOrders')}
                  value={order.productionOrderNumbers.join(', ')}
                />
              ) : null}
              <FactRow
                icon="hourglass-outline"
                label={t('mobile.inventory.fgDaysInFinished')}
                value={String(order.daysWaiting)}
              />
              {order.enteredAt ? (
                <FactRow
                  icon="log-in-outline"
                  label={t('mobile.inventory.fgEnteredFinished')}
                  value={formatDateTime(order.enteredAt)}
                />
              ) : null}
              {order.leftAt ? (
                <FactRow
                  icon="log-out-outline"
                  label={t('mobile.inventory.fgLeftFinished')}
                  value={formatDateTime(order.leftAt)}
                />
              ) : null}
              {order.deliveryNumber ? (
                <FactRow
                  icon="bus-outline"
                  label={t('mobile.inventory.fgDelivery')}
                  value={order.deliveryNumber}
                />
              ) : null}
              <FactRow
                icon="checkbox-outline"
                label={t('mobile.inventory.fgLoading')}
                value={t('mobile.inventory.fgLoadProgress', {
                  checked: checkedCount,
                  total: packages.length,
                })}
                last
              />
            </FloorCard>
          </View>

          {/* Packages — primary warehouse signal */}
          <View style={{ gap: theme.spacing.xs }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
              }}
            >
              <SectionTitle>{t('mobile.inventory.fgPackagesSection')}</SectionTitle>
              <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                {t('mobile.inventory.fgLoadProgress', {
                  checked: checkedCount,
                  total: packages.length,
                })}
              </AppText>
            </View>
            <FloorCard>
              {packages.length === 0 ? (
                <View style={{ padding: theme.spacing.lg }}>
                  <AppText color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t('mobile.inventory.fgPackagesEmpty')}
                  </AppText>
                </View>
              ) : (
                packages.map((row, index) => (
                  <PackageListRow
                    key={row.key}
                    row={row}
                    index={index}
                    total={packages.length}
                  />
                ))
              )}
            </FloorCard>
          </View>

          {/* Warehouses */}
          <View style={{ gap: theme.spacing.xs }}>
            <SectionTitle>{t('mobile.inventory.fgWarehouseBreakdown')}</SectionTitle>
            {lotsByWarehouse.map((group) => (
              <FloorCard key={group.label}>
                <View
                  style={{
                    padding: theme.spacing.md,
                    gap: theme.spacing.sm,
                    borderBottomWidth: group.lots.length ? 1 : 0,
                    borderBottomColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <Ionicons name="business-outline" size={16} color={colors.brand} />
                    <AppText weight="semibold" style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                      {group.label}
                    </AppText>
                  </View>
                </View>
                {group.lots.map((lot, idx) => (
                  <View
                    key={lot.id}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm + 2,
                      borderBottomWidth: idx < group.lots.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <AppText style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                      {t('mobile.inventory.qtyOnHand', { qty: Number(lot.quantity) || 0 })}
                    </AppText>
                    {lot.location?.code ? (
                      <AppText variant="caption" color="muted" dir="ltr">
                        {lot.location.code}
                      </AppText>
                    ) : null}
                    {lot.qrCode ? (
                      <AppText variant="caption" color="secondary" dir="ltr" numberOfLines={1}>
                        {lot.qrCode}
                      </AppText>
                    ) : null}
                  </View>
                ))}
              </FloorCard>
            ))}
          </View>

          {/* Actions */}
          <View style={{ gap: theme.spacing.xs }}>
            <SectionTitle>{t('mobile.inventory.fgActions')}</SectionTitle>
            <FloorCard>
              {(
                [
                  {
                    key: 'order',
                    label: t('lifecycle.viewOrder'),
                    icon: 'document-text-outline' as const,
                    onPress: () =>
                      router.push(`/(app)/(admin)/orders/${order.salesOrderId}` as Href),
                  },
                  order.productionOrderIds[0]
                    ? {
                        key: 'production',
                        label: t('mobile.inventory.fgViewProduction'),
                        icon: 'construct-outline' as const,
                        onPress: () =>
                          router.push(
                            `/(app)/(admin)/production/${order.productionOrderIds[0]}` as Href,
                          ),
                      }
                    : null,
                  deliveryId && canDelivery
                    ? {
                        key: 'delivery',
                        label: t('mobile.inventory.fgViewDelivery'),
                        icon: 'bus-outline' as const,
                        onPress: () =>
                          router.push(`/(app)/(admin)/deliveries/${deliveryId}` as Href),
                      }
                    : null,
                  canTransfer && order.lots[0]
                    ? {
                        key: 'transfer',
                        label: t('mobile.inventory.transfer'),
                        icon: 'swap-horizontal-outline' as const,
                        onPress: () => void openOps('transfer'),
                        disabled: opsLoading,
                      }
                    : null,
                  canCount && order.lots[0]
                    ? {
                        key: 'count',
                        label: t('mobile.inventory.count'),
                        icon: 'clipboard-outline' as const,
                        onPress: () => void openOps('count'),
                        disabled: opsLoading,
                      }
                    : null,
                ] as Array<{
                  key: string;
                  label: string;
                  icon: keyof typeof Ionicons.glyphMap;
                  onPress: () => void;
                  disabled?: boolean;
                } | null>
              )
                .filter((row): row is NonNullable<typeof row> => Boolean(row))
                .map((row, index, list) => (
                  <ActionRow
                    key={row.key}
                    label={row.label}
                    icon={row.icon}
                    onPress={row.onPress}
                    disabled={row.disabled}
                    last={index === list.length - 1}
                  />
                ))}
            </FloorCard>
          </View>
        </ScrollView>
      )}

      <CreateTransferSheet
        open={opsMode === 'transfer'}
        onClose={closeOps}
        lifecycle="finished"
        warehouses={fgWarehouses}
        initialItem={opsItem}
        initialFromWarehouseId={opsFromWarehouseId}
        initialQty={opsQty}
        loading={
          createTransferMutation.isPending ||
          completeTransferMutation.isPending ||
          opsLoading
        }
        onSubmit={(body) => {
          createTransferMutation.mutate(body, {
            onSuccess: (transfer) => {
              completeTransferMutation.mutate(transfer.id, {
                onSuccess: () => {
                  void haptics.confirmMedium();
                  closeOps();
                  void fgQuery.refetch();
                  void historyQuery.refetch();
                  showToast({
                    variant: 'success',
                    message: t('mobile.inventory.transferCompleted'),
                  });
                },
                onError: () => {
                  void haptics.error();
                  showToast({
                    variant: 'error',
                    message: t('mobile.inventory.transferCompleteFailed'),
                  });
                },
              });
            },
            onError: () => {
              void haptics.error();
              showToast({
                variant: 'error',
                message: t('mobile.inventory.transferCreateFailed'),
              });
            },
          });
        }}
      />

      <CreateStockCountSheet
        open={opsMode === 'count'}
        onClose={closeOps}
        lifecycle="finished"
        warehouses={fgWarehouses}
        initialItem={opsItem}
        initialWarehouseId={opsFromWarehouseId}
        loading={createCountMutation.isPending || opsLoading}
        onSubmit={(body) => {
          createCountMutation.mutate(body, {
            onSuccess: () => {
              void haptics.confirmMedium();
              closeOps();
              showToast({
                variant: 'success',
                message: t('mobile.inventory.countCreated'),
              });
            },
            onError: () => {
              void haptics.error();
              showToast({
                variant: 'error',
                message: t('mobile.inventory.countCreateFailed'),
              });
            },
          });
        }}
      />
    </AppScreen>
  );
}
