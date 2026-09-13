import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { invalidateFactoryJourney } from '@/api/invalidateFactoryJourney';
import { toastMessageForError } from '@/api/queryClient';
import { allocateFabricFromStock, listFabricProcurements } from '@/api/modules/purchasing';
import { listFabricHolding } from '@/api/modules/inventory';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { useToast } from '@/components/feedback/Toast';
import { FabricActionSheet } from '@/features/fabric/FabricActionSheet';
import { FabricDeskSummary } from '@/features/fabric/FabricDeskSummary';
import { FabricGeneralStockCard } from '@/features/fabric/FabricGeneralStockCard';
import { OrderFabricGroupCard } from '@/features/fabric/OrderFabricGroupCard';
import {
  fabricAwaitsSupply,
  fabricDeskBucketCounts,
  fabricRemainingNeed,
  fabricRowDestination,
  fabricRowFromHolding,
  fabricStockCoverage,
  fabricStockMatchesQuery,
  filterFabricRowsByQuery,
  filterRowsByDeskBucket,
  groupFabricRowsBySalesOrder,
  mergeFabricDeskRows,
  selectFabricTrackerRows,
  type FabricDeskBucket,
  type FabricOrderGroup,
  type FabricTrackerRow,
} from '@/features/fabric/selectFabricTracker';
import {
  flattenInventoryItemPages,
  useInventoryItemsInfiniteQuery,
} from '@/features/inventory/query';
import { selectInventoryItemCard, type InventoryItemCardModel } from '@/features/inventory/selectInventory';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { InventoryListSkeleton } from './InventorySkeleton';

type Props = {
  q?: string;
  enabled?: boolean;
};

/**
 * Inventory fabric desk — order first, then fabric-native general stock rolls.
 */
export function FabricDeskSection({ q, enabled = true }: Props) {
  const { user } = useAuth();
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const canProcurement = can(user, 'fabric.procurement.read');
  const canManage = can(user, 'fabric.procurement.manage');
  const canOverride = can(user, 'production.fabric.override');
  const canReadOrder = can(user, 'sales-order.read');
  const [bucket, setBucket] = useState<FabricDeskBucket | null>(null);
  const [stockPick, setStockPick] = useState<InventoryItemCardModel | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [allocQty, setAllocQty] = useState('');
  const [replaceReason, setReplaceReason] = useState('');
  const [allocStep, setAllocStep] = useState<'pick' | 'qty'>('pick');
  const [search, setSearch] = useState('');
  const [needle, setNeedle] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setNeedle(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const serverQ = needle || q || undefined;
  const searchActive = search.trim().length > 0;

  const holdingQuery = useQuery({
    queryKey: queryKeys.inventory.fabricHolding(serverQ),
    queryFn: () => listFabricHolding(serverQ),
    enabled,
  });

  const queueQuery = useQuery({
    queryKey: queryKeys.purchasing.fabricList({ q: serverQ, desk: true }),
    queryFn: () => listFabricProcurements({ q: serverQ }),
    enabled: enabled && canProcurement,
  });

  const stockQuery = useInventoryItemsInfiniteQuery(
    { categoryGroup: 'fabric', q: serverQ },
    enabled,
  );
  const stockItems = useMemo(
    () => flattenInventoryItemPages(stockQuery.data).map((raw) => selectInventoryItemCard(raw, locale)),
    [stockQuery.data, locale],
  );

  const queueRows = useMemo(
    () => (queueQuery.data ? selectFabricTrackerRows(queueQuery.data) : []),
    [queueQuery.data],
  );
  const holdingRows = useMemo(
    () => (holdingQuery.data?.holding ?? []).map(fabricRowFromHolding),
    [holdingQuery.data],
  );
  const merged = useMemo(
    () => mergeFabricDeskRows(canProcurement ? queueRows : [], holdingRows),
    [canProcurement, queueRows, holdingRows],
  );
  const searched = useMemo(() => filterFabricRowsByQuery(merged, search), [merged, search]);
  const counts = useMemo(() => fabricDeskBucketCounts(searched), [searched]);
  const visible = useMemo(() => filterRowsByDeskBucket(searched, bucket), [searched, bucket]);
  const groups = useMemo(() => groupFabricRowsBySalesOrder(visible), [visible]);
  const visibleStock = useMemo(
    () => stockItems.filter((item) => fabricStockMatchesQuery(item, search)),
    [stockItems, search],
  );
  const awaiting = useMemo(() => merged.filter(fabricAwaitsSupply), [merged]);
  const sameRows = useMemo(() => {
    if (!stockPick) return [] as FabricTrackerRow[];
    return awaiting.filter((r) => !r.inventoryItemId || r.inventoryItemId === stockPick.id);
  }, [awaiting, stockPick]);
  const otherRows = useMemo(() => {
    if (!stockPick) return [] as FabricTrackerRow[];
    return awaiting.filter((r) => Boolean(r.inventoryItemId && r.inventoryItemId !== stockPick.id));
  }, [awaiting, stockPick]);
  const sameGroups = useMemo(() => groupFabricRowsBySalesOrder(sameRows), [sameRows]);
  const otherGroups = useMemo(() => groupFabricRowsBySalesOrder(otherRows), [otherRows]);
  const selectedOrder = awaiting.find((r) => r.id === orderId);
  const isReplace = Boolean(
    stockPick && selectedOrder?.inventoryItemId && selectedOrder.inventoryItemId !== stockPick.id,
  );
  const allocMax = stockPick
    ? Math.min(
        stockPick.freeQty,
        fabricRemainingNeed(selectedOrder ?? { expectedQty: null, arrivedQty: 0 }) ??
          stockPick.freeQty,
      )
    : undefined;
  const stockFreeByItemId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of stockItems) {
      if (item.freeQty > 0) map[item.id] = item.freeQty;
    }
    return map;
  }, [stockItems]);

  const allocate = useMutation({
    mutationFn: () =>
      allocateFabricFromStock(orderId!, {
        inventoryItemId: stockPick!.id,
        qty: Number(allocQty),
        replaceFabric: isReplace || undefined,
        reason: isReplace ? replaceReason.trim() : undefined,
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.purchasing.fabricLists() }),
        qc.invalidateQueries({ queryKey: [...queryKeys.inventory.all, 'fabric-holding'] }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.lists() }),
        invalidateFactoryJourney(qc),
      ]);
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('mobile.purchasing.fabricAllocateSuccess') });
      setStockPick(null);
      setOrderId(null);
      setAllocQty('');
      setReplaceReason('');
      setAllocStep('pick');
    },
    onError: (err) => {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.purchasing.updateFailed'),
      });
    },
  });

  if (!enabled) return null;

  const loading = holdingQuery.isLoading || (canProcurement && queueQuery.isLoading);
  const failed = holdingQuery.isError && (!canProcurement || queueQuery.isError);
  const nothing = merged.length === 0;

  function openFabric(row: FabricTrackerRow) {
    const dest = fabricRowDestination(row);
    if (dest.kind === 'bundle') {
      router.push(
        `/(app)/(admin)/inventory/fabric-bundle/${encodeURIComponent(dest.code)}` as Href,
      );
      return;
    }
    if (canProcurement) {
      router.push(`/(app)/(admin)/purchasing/fabric/${dest.id}` as Href);
    }
  }

  function openOrder(salesOrderId: string | null) {
    if (!salesOrderId || !canReadOrder) return;
    router.push(`/(app)/(admin)/orders/${salesOrderId}` as Href);
  }

  function onSelectBucket(next: FabricDeskBucket | null) {
    setBucket(next);
    if (!next) return;
    const rows = filterRowsByDeskBucket(searched, next);
    if (rows.length === 1) openFabric(rows[0]!);
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      {loading && nothing ? <InventoryListSkeleton /> : null}

      {failed ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" style={{ color: colors.error }}>
            {t('mobile.purchasing.fabricLoadFailed')}
          </AppText>
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.purchasing.fabricRetry')}
            onPress={() => {
              void haptics.selection();
              void holdingQuery.refetch();
              void queueQuery.refetch();
            }}
          >
            <AppText variant="caption" weight={titleWeight} style={{ color: colors.brand }}>
              {t('mobile.purchasing.fabricRetry')}
            </AppText>
          </AnimatedPressable>
        </View>
      ) : null}

      {!failed && !loading && (!nothing || searchActive) ? (
        <FabricDeskSummary
          counts={counts}
          active={bucket}
          onSelect={onSelectBucket}
          search={search}
          onChangeSearch={setSearch}
          searchPlaceholder={t('mobile.inventory.fabricDeskSearchPlaceholder')}
        />
      ) : null}

      {!failed && !loading ? (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ gap: 2 }}>
            <AppText
              variant="body"
              weight={titleWeight}
              style={{ textAlign: isRTL ? 'right' : 'left', color: colors.brand }}
            >
              {t('mobile.inventory.fabricDeskTitle')}
            </AppText>
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('mobile.inventory.fabricDeskHint')}
            </AppText>
          </View>

          {groups.length === 0 ? (
            searchActive ? (
              <DeskSearchEmpty onClear={() => setSearch('')} />
            ) : (
              <AppText variant="caption" color="muted">
                {nothing
                  ? t('mobile.inventory.fabricDeskEmpty')
                  : t('mobile.inventory.fabricLaneEmpty')}
              </AppText>
            )
          ) : (
            groups.map((group, index) => (
              <ListItemEnter key={group.id} index={index}>
                <OrderFabricGroupCard
                  group={group}
                  onPressOrder={
                    group.salesOrderId && canReadOrder
                      ? () => openOrder(group.salesOrderId)
                      : undefined
                  }
                  onPressFabric={openFabric}
                  surface="desk"
                  stockFreeByItemId={stockFreeByItemId}
                />
              </ListItemEnter>
            ))
          )}
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
        <View style={{ gap: 2 }}>
          <AppText weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.inventory.generalFabricStock')}
          </AppText>
          <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.inventory.generalFabricStockHint')}
          </AppText>
        </View>
        {visibleStock.length === 0 ? (
          searchActive ? (
            <DeskSearchEmpty onClear={() => setSearch('')} />
          ) : (
            <AppText variant="caption" color="muted">
              {t('mobile.inventory.fabricNoFreeStock')}
            </AppText>
          )
        ) : (
          visibleStock.map((item, index) => (
            <FabricGeneralStockCard
              key={item.id}
              item={item}
              index={index}
              canAllocate={canManage}
              onPress={() =>
                router.push(`/(app)/(admin)/inventory/items/${item.id}` as Href)
              }
              onUseForOrder={() => {
                setStockPick(item);
                setOrderId(null);
                setAllocQty('');
                setReplaceReason('');
                setAllocStep('pick');
              }}
            />
          ))
        )}
      </View>

      <FabricActionSheet
        open={Boolean(stockPick)}
        onClose={() => {
          setStockPick(null);
          setOrderId(null);
          setAllocQty('');
          setReplaceReason('');
          setAllocStep('pick');
        }}
        title={
          allocStep === 'pick'
            ? t('mobile.inventory.fabricPickOrderLine')
            : t('mobile.inventory.fabricUseForOrder')
        }
        icon="link-outline"
        primaryLabel={
          allocStep === 'pick'
            ? t('mobile.inventory.fabricUseForOrderContinue')
            : t('mobile.inventory.fabricUseForOrder')
        }
        primaryDisabled={
          allocStep === 'pick'
            ? !orderId
            : !(Number(allocQty) > 0) || (isReplace && replaceReason.trim().length < 3)
        }
        primaryLoading={allocate.isPending}
        onPrimary={() => {
          if (allocStep === 'pick') {
            if (!orderId) return;
            setAllocStep('qty');
            return;
          }
          if (!orderId || allocate.isPending) return;
          allocate.mutate();
        }}
        onSecondary={
          allocStep === 'qty'
            ? () => {
                setAllocStep('pick');
              }
            : undefined
        }
        secondaryLabel={allocStep === 'qty' ? t('common.back') : undefined}
      >
        {allocStep === 'pick' ? (
          <AllocPickStep
            sameGroups={sameGroups}
            otherGroups={canOverride ? otherGroups : []}
            orderId={orderId}
            stockPick={stockPick}
            showOtherEmpty={sameRows.length === 0 && otherRows.length > 0 && !canOverride}
            onPick={(row) => {
              void haptics.selection();
              setOrderId(row.id);
              const need = fabricRemainingNeed(row);
              if (stockPick && need != null) {
                setAllocQty(String(Math.min(stockPick.freeQty, need || stockPick.freeQty)));
              } else {
                setAllocQty('');
              }
              setReplaceReason('');
            }}
          />
        ) : (
          <AllocQtyStep
            row={selectedOrder}
            stockPick={stockPick}
            allocQty={allocQty}
            onChangeQty={setAllocQty}
            allocMax={allocMax}
            isReplace={isReplace}
            replaceReason={replaceReason}
            onChangeReason={setReplaceReason}
          />
        )}
      </FabricActionSheet>
    </View>
  );
}

function DeskSearchEmpty({ onClear }: { onClear: () => void }) {
  const { t, isRTL, locale } = useLocale();
  const { colors } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {t('mobile.inventory.fabricSearchNoMatches')}
      </AppText>
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.inventory.fabricSearchClear')}
        onPress={() => {
          void haptics.selection();
          onClear();
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{ color: colors.brand, textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.inventory.fabricSearchClear')}
        </AppText>
      </AnimatedPressable>
    </View>
  );
}

function coverageCaption(
  row: FabricTrackerRow,
  free: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string | null {
  if (!(free > 0)) return null;
  const need = fabricRemainingNeed(row);
  const cover = fabricStockCoverage({ need, free });
  if (cover === 'partial' && need != null) {
    return t('mobile.inventory.fabricCoversPartial', { free, need, unit: row.unit });
  }
  if (cover === 'full' && need != null) {
    return t('mobile.inventory.fabricCoversAll', { need, unit: row.unit });
  }
  return t('mobile.inventory.fabricInGeneralStock');
}

function AllocPickStep({
  sameGroups,
  otherGroups,
  orderId,
  stockPick,
  showOtherEmpty,
  onPick,
}: {
  sameGroups: FabricOrderGroup[];
  otherGroups: FabricOrderGroup[];
  orderId: string | null;
  stockPick: InventoryItemCardModel | null;
  showOtherEmpty: boolean;
  onPick: (row: FabricTrackerRow) => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const free = stockPick?.freeQty ?? 0;

  if (sameGroups.length === 0 && otherGroups.length === 0) {
    return (
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {showOtherEmpty
          ? t('mobile.inventory.fabricOtherOrdersNeedDifferent')
          : t('mobile.inventory.fabricNoOrdersForStock')}
      </AppText>
    );
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      {sameGroups.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText
            variant="caption"
            weight={titleWeight}
            style={{ color: colors.brand, textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.inventory.fabricSameAsStock')}
          </AppText>
          {sameGroups.map((group) => (
            <AllocOrderGroup
              key={group.key}
              group={group}
              orderId={orderId}
              free={free}
              onPick={onPick}
            />
          ))}
        </View>
      ) : null}
      {otherGroups.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText
            variant="caption"
            weight={titleWeight}
            style={{ color: colors.brand, textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.inventory.fabricDifferentFromStock')}
          </AppText>
          {otherGroups.map((group) => (
            <AllocOrderGroup
              key={group.key}
              group={group}
              orderId={orderId}
              free={free}
              onPick={onPick}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function AllocOrderGroup({
  group,
  orderId,
  free,
  onPick,
}: {
  group: FabricOrderGroup;
  orderId: string | null;
  free: number;
  onPick: (row: FabricTrackerRow) => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText weight={titleWeight} dir="ltr" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {group.orderNumber ?? t('mobile.inventory.fabricUnassignedOrder')}
      </AppText>
      {group.rows.map((row) => {
        const active = orderId === row.id;
        const cover = coverageCaption(row, free, t);
        return (
          <AnimatedPressable
            key={row.id}
            variant="button"
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onPick(row)}
            style={{
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: active ? colors.brand : colors.border,
              backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
              padding: theme.spacing.md,
              gap: 2,
            }}
          >
            <AppText
              weight={titleWeight}
              style={{ color: active ? colors.brand : colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }}
            >
              {row.label}
            </AppText>
            {cover ? (
              <AppText variant="caption" style={{ color: colors.brand, textAlign: isRTL ? 'right' : 'left' }}>
                {cover}
              </AppText>
            ) : null}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

function AllocQtyStep({
  row,
  stockPick,
  allocQty,
  onChangeQty,
  allocMax,
  isReplace,
  replaceReason,
  onChangeReason,
}: {
  row?: FabricTrackerRow;
  stockPick: InventoryItemCardModel | null;
  allocQty: string;
  onChangeQty: (next: string) => void;
  allocMax: number | undefined;
  isReplace: boolean;
  replaceReason: string;
  onChangeReason: (next: string) => void;
}) {
  const { t, isRTL, formatNumber } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      {row ? (
        <View style={{ gap: 2 }}>
          {row.orderNumber ? (
            <AppText weight="semibold" dir="ltr">
              {row.orderNumber}
            </AppText>
          ) : null}
          <AppText style={{ textAlign: isRTL ? 'right' : 'left' }}>{row.label}</AppText>
        </View>
      ) : null}
      {isReplace && row ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" style={{ color: colors.brand, textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.inventory.fabricReplacing', { fabric: row.label })}
          </AppText>
          {row.purchaseOrderId ? (
            <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('mobile.inventory.fabricReplacePoWarning')}
            </AppText>
          ) : null}
          <TextField
            label={t('mobile.inventory.fabricReplaceReason')}
            value={replaceReason}
            onChangeText={onChangeReason}
            error={
              replaceReason.length > 0 && replaceReason.trim().length < 3
                ? t('mobile.purchasing.fabricOverrideTooShort')
                : undefined
            }
          />
        </View>
      ) : null}
      <QtyStepperField
        label={t('mobile.purchasing.quantity')}
        value={allocQty}
        onChangeText={onChangeQty}
        min={0}
        max={allocMax}
        step={0.5}
        unit={stockPick?.unit}
      />
      {stockPick ? (
        <AppText variant="caption" color="muted" dir="ltr">
          {formatNumber(stockPick.freeQty)} {stockPick.unit} {t('mobile.inventory.available')}
        </AppText>
      ) : null}
    </View>
  );
}
