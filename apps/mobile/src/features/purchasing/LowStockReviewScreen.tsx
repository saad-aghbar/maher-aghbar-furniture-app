import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { listWarehouses, updateInventoryItem } from '@/api/modules/inventory';
import type { PurchaseRunWhatsAppMessage } from '@/api/modules/purchasing';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { AppScreen } from '@/components/layout/AppScreen';
import { Divider } from '@/components/layout/Divider';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { locationsForWarehouse } from '@/features/inventory/components/WarehouseBinBoard';
import { pickDefaultLocationId } from '@/features/inventory/pickDefaultLocation';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { draftPurchaseRunWhatsApp } from './api';
import { DestinationPickSheet } from './components/DestinationPickSheet';
import { PurchaseWhatsAppPreviewSheet } from './components/PurchaseWhatsAppPreviewSheet';
import { PurchasingFloorBoard } from './components/PurchasingFloorBoard';
import { PurchasingSkeleton } from './components/PurchasingSkeleton';
import { PurchasingSupplierSheet } from './components/PurchasingSupplierSheet';
import { ReceiveFloorTrigger } from './components/ReceiveFloorTrigger';
import {
  applyLowStockDestinationNames,
  buildLowStockBatchPayload,
  groupLowStockRows,
  includedLowStockRows,
  lowStockConfirmBlocked,
  lowStockDestinationLabel,
  lowStockRunSummary,
  moveLowStockRow,
  seedLowStockExcluded,
  seedLowStockRows,
  toggleLowStockExcluded,
  updateLowStockDest,
  updateLowStockQty,
  type LowStockReviewRow,
} from './lowStockReview';
import {
  useCreatePurchaseOrdersBatchMutation,
  useLowStockDraftQuery,
  usePurchaseRunActions,
  useSuppliersQuery,
} from './query';

export function LowStockReviewScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale, isRTL, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const canCreate = can(user, 'purchase-order.create');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/purchasing' as Href;

  const draftQuery = useLowStockDraftQuery(canCreate);
  const suppliersQuery = useSuppliersQuery(canCreate, { status: 'ACTIVE' });
  const warehousesQuery = useQuery({
    queryKey: ['warehouses-low-stock'],
    queryFn: listWarehouses,
    enabled: canCreate,
  });
  const batch = useCreatePurchaseOrdersBatchMutation();

  const [rows, setRows] = useState<LowStockReviewRow[] | null>(null);
  const [excluded, setExcluded] = useState<Set<string> | null>(null);
  const [moveItemId, setMoveItemId] = useState<string | null>(null);
  const [destOpen, setDestOpen] = useState<{ id: string; mode: 'warehouse' | 'location' } | null>(null);
  const [savingDefault, setSavingDefault] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [createdRunId, setCreatedRunId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PurchaseRunWhatsAppMessage[]>([]);
  const runActions = usePurchaseRunActions(createdRunId ?? '');

  const seeded = useMemo(() => {
    if (!draftQuery.data) return [];
    return seedLowStockRows(draftQuery.data);
  }, [draftQuery.data]);

  const working = rows ?? seeded;
  const workingExcluded = excluded ?? seedLowStockExcluded(working);
  const groups = groupLowStockRows(working);
  const summary = lowStockRunSummary(working, workingExcluded);
  const blocked = lowStockConfirmBlocked(working, workingExcluded);
  const destRow = destOpen ? working.find((r) => r.itemId === destOpen.id) : null;
  const rawWarehouses = useMemo(
    () => (warehousesQuery.data ?? []).filter((w) => !w.type || w.type === 'RAW_MATERIALS'),
    [warehousesQuery.data],
  );
  const dockPad = stickyCtaBottomInset(insets.bottom, theme.spacing.md, SURFACE_TAB_BAR_CLEARANCE) + 140;

  useEffect(() => {
    if (!seeded.length) return;
    setRows((prev) =>
      applyLowStockDestinationNames(
        prev && prev.length > 0 ? prev : seeded,
        rawWarehouses,
        locale,
      ),
    );
  }, [rawWarehouses, locale, seeded]);

  const supplierOptions = useMemo(
    () =>
      (suppliersQuery.data?.data ?? []).map((s) => ({
        id: s.id,
        name: localizedName(
          locale,
          { name: s.name, nameEn: s.nameEn, nameAr: s.nameAr, nameHe: s.nameHe },
          s.code,
        ),
        code: s.code,
        searchText: [s.name, s.nameEn, s.nameAr, s.nameHe, s.code].filter(Boolean).join(' '),
      })),
    [suppliersQuery.data?.data, locale],
  );

  const supplierName = (id: string | null) =>
    supplierOptions.find((s) => s.id === id)?.name ?? t('mobile.purchasing.unassignedSupplier');

  const rowName = (row: LowStockReviewRow) =>
    locale === 'ar' ? row.nameAr || row.nameEn || row.sku : row.nameEn || row.nameAr || row.sku;

  const toggleRow = (itemId: string) => {
    void haptics.selection();
    setExcluded(toggleLowStockExcluded(workingExcluded, itemId));
  };

  const confirmRun = () => {
    if (blocked) {
      void haptics.error();
      showToast({
        variant: 'error',
        message:
          blocked === 'unassigned'
            ? t('mobile.purchasing.lowStockConfirmBlocked')
            : blocked === 'holding'
              ? t('mobile.purchasing.holdingRequired')
              : t('mobile.purchasing.builderEmptyLines'),
      });
      return;
    }
    const orders = buildLowStockBatchPayload(working, workingExcluded);
    batch.mutate(
      { orders },
      {
        onSuccess: async (result) => {
          void haptics.confirmMedium();
          const runId = result.run?.id ?? null;
          setCreatedRunId(runId);
          if (runId) {
            try {
              const draft = await draftPurchaseRunWhatsApp(runId);
              setMessages(draft.messages);
              setPreviewOpen(true);
              return;
            } catch {
              router.replace(`/(app)/(admin)/purchasing/runs/${runId}` as Href);
              return;
            }
          }
          showToast({ variant: 'success', message: t('mobile.purchasing.createSuccess') });
        },
        onError: (err) => {
          void haptics.error();
          showToast({
            variant: 'error',
            message: isApiError(err) ? toastMessageForError(err) : t('mobile.purchasing.batchCreateFailed'),
          });
        },
      },
    );
  };

  if (!canCreate) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (draftQuery.isError && !draftQuery.data) {
    return (
      <AppScreen backFallback={backFallback}>
        <ErrorState
          title={t('mobile.purchasing.errorTitle')}
          description={t('mobile.purchasing.errorBody')}
          retryLabel={t('mobile.purchasing.retry')}
          onRetry={() => void draftQuery.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={backFallback}>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: dockPad }}>
        <AppText variant="largeTitle" weight={titleWeight} align="center">
          {t('mobile.purchasing.lowStockTitle')}
        </AppText>
        {working.length > 0 ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: 'center' }}
          >
            {t('mobile.purchasing.lowStockPickHint')}
          </AppText>
        ) : null}
        {draftQuery.isLoading ? <PurchasingSkeleton /> : null}
        {working.length === 0 && !draftQuery.isLoading ? (
          <DealerEmptyPanel
            text={t('mobile.purchasing.lowStockEmptyBody')}
            icon="flash-outline"
          />
        ) : null}

        {groups.map((group, gi) => (
          <View key={group.supplierId ?? 'unassigned'} style={{ gap: theme.spacing.sm }}>
            <ListItemEnter index={gi}>
              <PurchasingFloorBoard
                title={`${supplierName(group.supplierId)} · ${t('mobile.purchasing.perSupplierItems', { count: String(group.items.length) })}`}
                hideBody={Boolean(group.supplierId)}
              >
                {!group.supplierId ? (
                  <AppText variant="caption" style={{ color: colors.warning }}>
                    {t('mobile.purchasing.unassignedSupplierHint')}
                  </AppText>
                ) : null}
              </PurchasingFloorBoard>
            </ListItemEnter>
            {group.items.map((row, index) => {
              const selected = !workingExcluded.has(row.itemId);
              const destLabel = lowStockDestinationLabel(row);
              const destMissing = !row.warehouseId || !row.locationId;
              return (
                <ListItemEnter key={row.itemId} index={gi + index + 1}>
                  <PurchasingFloorBoard
                    title={rowName(row)}
                    headerAccent={selected}
                    onHeaderPress={() => toggleRow(row.itemId)}
                    trailing={
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: selected ? colors.brand : colors.surface,
                          borderWidth: 1,
                          borderColor: selected ? colors.brand : colors.borderStrong,
                        }}
                      >
                        {selected ? (
                          <Ionicons name="checkmark" size={16} color={colors.onBrand} />
                        ) : (
                          <Ionicons name="add" size={16} color={colors.textMuted} />
                        )}
                      </View>
                    }
                    contentStyle={{ gap: theme.spacing.sm }}
                  >
                    <ReceiveFloorTrigger
                      icon={selected ? 'checkbox' : 'square-outline'}
                      label={
                        selected
                          ? t('mobile.purchasing.addedToLowStockOrder')
                          : t('mobile.purchasing.addToLowStockOrder')
                      }
                      success={selected}
                      onPress={() => toggleRow(row.itemId)}
                    />
                    <View
                      style={{
                        borderRadius: theme.radius.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceSecondary,
                        overflow: 'hidden',
                        opacity: selected ? 1 : 0.7,
                      }}
                    >
                      <MetaRow label={t('catalog.sku')} value={row.sku} valueLtr />
                      <Divider compact plain />
                      <MetaRow
                        label={t('mobile.purchasing.onHand')}
                        value={`${row.onHandQty} · ${t('mobile.purchasing.minStock')} ${row.minStock}`}
                        valueLtr
                      />
                    </View>
                    {row.coveredByOpenOrder ? (
                      <View
                        style={{
                          alignSelf: isRTL ? 'flex-end' : 'flex-start',
                          borderRadius: theme.radius.full,
                          backgroundColor: colors.warningSoft,
                          paddingHorizontal: theme.spacing.sm,
                          minHeight: 24,
                          justifyContent: 'center',
                        }}
                      >
                        <AppText variant="caption" style={{ color: colors.warning }}>
                          {t('mobile.purchasing.alreadyOnOrder', {
                            qty: String(row.onOrderQty || 0),
                          })}
                        </AppText>
                      </View>
                    ) : null}
                    {row.reason ? (
                      <AppText
                        variant="caption"
                        color="muted"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      >
                        {t(`mobile.purchasing.reason${row.reason === 'BOTH' ? 'Both' : row.reason === 'PRODUCTION' ? 'Production' : 'LowStock'}`)}
                      </AppText>
                    ) : null}
                    {selected ? (
                      <>
                        <ReceiveFloorTrigger
                          icon={row.isFabric ? 'location-outline' : 'cube-outline'}
                          label={
                            row.warehouseName ||
                            destLabel ||
                            (row.isFabric
                              ? t('mobile.purchasing.pickHoldingLocation')
                              : t('mobile.purchasing.pickWarehouse'))
                          }
                          caption={row.locationName}
                          active={Boolean(destLabel)}
                          warning={destMissing}
                          onPress={() =>
                            setDestOpen({
                              id: row.itemId,
                              mode: row.isFabric ? 'location' : 'warehouse',
                            })
                          }
                        />
                        <ReceiveFloorTrigger
                          icon="person-outline"
                          label={supplierName(row.supplierId)}
                          active={Boolean(row.supplierId)}
                          warning={!row.supplierId}
                          onPress={() => setMoveItemId(row.itemId)}
                        />
                        <QtyStepperField
                          label={t('mobile.purchasing.orderQty')}
                          value={row.orderQty}
                          onChangeText={(v) => setRows(updateLowStockQty(working, row.itemId, v))}
                        />
                        <ReceiveFloorTrigger
                          icon="bookmark-outline"
                          label={t('mobile.purchasing.saveAsDefault')}
                          loading={savingDefault === row.itemId}
                          onPress={() => {
                            setSavingDefault(row.itemId);
                            void updateInventoryItem(row.itemId, { reorderQty: Number(row.orderQty) || null })
                              .then(() => {
                                void haptics.confirmLight();
                                showToast({ variant: 'success', message: t('mobile.purchasing.defaultSaved') });
                              })
                              .catch(() => {
                                void haptics.error();
                                showToast({ variant: 'error', message: t('mobile.purchasing.saveDefaultFailed') });
                              })
                              .finally(() => setSavingDefault(null));
                          }}
                        />
                      </>
                    ) : null}
                  </PurchasingFloorBoard>
                </ListItemEnter>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <FloatingActionDock floating>
        <PurchasingFloorBoard>
          <AppText variant="caption" color="muted" dir="ltr">
            {`${t('mobile.purchasing.suppliersCount', { count: String(summary.supplierCount) })} · ${t('mobile.purchasing.itemsCount', { count: String(summary.itemCount) })} · ${formatCurrency(summary.estimated)}`}
          </AppText>
          <PrimaryButton
            label={t('mobile.purchasing.confirmLowStockRun')}
            loading={batch.isPending}
            disabled={batch.isPending || includedLowStockRows(working, workingExcluded).length === 0}
            onPress={confirmRun}
            style={{ borderRadius: theme.radius.full, minHeight: 44 }}
          />
        </PurchasingFloorBoard>
      </FloatingActionDock>

      <PurchasingSupplierSheet
        open={Boolean(moveItemId)}
        onClose={() => setMoveItemId(null)}
        suppliers={supplierOptions}
        selectedId={working.find((r) => r.itemId === moveItemId)?.supplierId ?? null}
        allowNone={false}
        openOrdersBySupplier={new Map()}
        onConfirm={(s) => {
          if (moveItemId) setRows(moveLowStockRow(working, moveItemId, s?.id ?? null));
        }}
      />
      <DestinationPickSheet
        open={Boolean(destOpen)}
        onClose={() => setDestOpen(null)}
        mode={destOpen?.mode ?? 'warehouse'}
        warehouses={rawWarehouses}
        selectedWarehouseId={destRow?.warehouseId ?? ''}
        selectedLocationId={destRow?.locationId}
        onSelectWarehouse={(id) => {
          if (!destOpen) return;
          const next = updateLowStockDest(working, destOpen.id, {
            warehouseId: id,
            locationId: destRow?.isFabric
              ? destRow.locationId
              : pickDefaultLocationId(locationsForWarehouse(rawWarehouses.find((wh) => wh.id === id))),
          });
          setRows(applyLowStockDestinationNames(next, rawWarehouses, locale));
        }}
        onSelectLocation={(id, warehouseId) => {
          if (!destOpen) return;
          const next = updateLowStockDest(working, destOpen.id, { warehouseId, locationId: id });
          setRows(applyLowStockDestinationNames(next, rawWarehouses, locale));
        }}
      />
      <PurchaseWhatsAppPreviewSheet
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          if (createdRunId) {
            router.replace(`/(app)/(admin)/purchasing/runs/${createdRunId}` as Href);
          }
        }}
        sending={runActions.send.isPending}
        messages={messages}
        onSend={(payload) => {
          if (!createdRunId) return;
          runActions.send.mutate(payload, {
            onSuccess: (result) => {
              void haptics.confirmMedium();
              const failed = result.results.filter((row) => !row.ok).length;
              showToast({
                variant: failed ? 'warning' : 'success',
                message: failed
                  ? t('mobile.purchasing.sendPartial')
                  : t('mobile.purchasing.sendAllOk'),
              });
              setPreviewOpen(false);
              router.replace(`/(app)/(admin)/purchasing/runs/${createdRunId}` as Href);
            },
            onError: () =>
              showToast({ variant: 'error', message: t('mobile.purchasing.sendAllFailed') }),
          });
        }}
      />
    </AppScreen>
  );
}

function MetaRow({
  label,
  value,
  valueLtr,
}: {
  label: string;
  value: string;
  valueLtr?: boolean;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          flexShrink: 0,
          fontSize: 10,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.45,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight="medium"
        dir={valueLtr ? 'ltr' : undefined}
        numberOfLines={2}
        style={{
          flex: 1,
          minWidth: 0,
          color: colors.textPrimary,
          textAlign: isRTL ? 'left' : 'right',
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
