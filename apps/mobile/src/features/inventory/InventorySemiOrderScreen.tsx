import { useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { queryKeys } from '@/api/queryKeys';
import type { WipKitCard } from '@/api/modules/inventory';
import { fetchWipKitBoard, openWipKitQrLabelPdf } from './api';
import { InventoryListSkeleton } from './components/InventorySkeleton';
import { InventorySemiOrderDetailSheet } from './components/InventorySemiOrderDetailSheet';
import { InventoryFilterButton } from './components/InventoryFilterButton';
import {
  defaultSemiFilterDraft,
  InventorySemiFilterSheet,
  type SemiFilterDraft,
} from './components/InventorySemiFilterSheet';
import { InventorySemiStageGroup } from './components/InventorySemiStageGroup';
import { InventoryQrSheet, type InventoryQrItem } from './components/InventoryQrSheet';
import {
  boardParamsForSemiFilter,
  selectSemiOrderStageSections,
  type SemiOrderFilter,
} from './selectSemiOrders';

type StageGroupRow = {
  stageCode: string;
  title: string;
  kits: WipKitCard[];
};

/** Matches BackButton outer size so the title can sit truly centered. */
const BACK_SLOT = 44;

function defaultHistoryFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultHistoryTo(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Semi-finished for one production order — kits grouped by producing stage.
 */
export function InventorySemiOrderScreen() {
  const { orderId: orderIdParam } = useLocalSearchParams<{ orderId: string }>();
  const orderId = String(orderIdParam ?? '');
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const allowed = can(user, 'inventory.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const historyDefaults = useMemo(
    () => ({ historyFrom: defaultHistoryFrom(), historyTo: defaultHistoryTo() }),
    [],
  );
  const [filter, setFilter] = useState<SemiOrderFilter>('active');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<SemiFilterDraft>(() =>
    defaultSemiFilterDraft(historyDefaults),
  );
  const [inspectKitId, setInspectKitId] = useState<string | null>(null);
  const [inspectKitSeed, setInspectKitSeed] = useState<WipKitCard | null>(null);
  const [qrItem, setQrItem] = useState<InventoryQrItem | null>(null);
  const pendingPrintRef = useRef<{ id: string; sku: string; kind: 'wip-kit' } | null>(null);
  const pendingAfterSemiDetailRef = useRef<
    | { type: 'qr'; kit: WipKitCard }
    | { type: 'print'; kit: WipKitCard }
    | null
  >(null);

  const boardParams = useMemo(
    () => ({
      productionOrderId: orderId || undefined,
      ...boardParamsForSemiFilter(filter),
    }),
    [orderId, filter],
  );

  const boardQuery = useQuery({
    queryKey: queryKeys.inventory.wipKitBoard(boardParams),
    queryFn: () => fetchWipKitBoard(boardParams),
    enabled: allowed && Boolean(orderId),
  });

  const sections = useMemo(
    () =>
      selectSemiOrderStageSections(boardQuery.data?.sections ?? [], {
        filter,
      }),
    [boardQuery.data?.sections, filter],
  );

  const orderMeta = useMemo(() => {
    for (const section of sections) {
      const kit = section.kits[0];
      if (kit) return kit.productionOrder;
    }
    for (const section of boardQuery.data?.sections ?? []) {
      const kit = section.kits[0];
      if (kit) return kit.productionOrder;
    }
    return null;
  }, [sections, boardQuery.data?.sections]);

  const groups: StageGroupRow[] = useMemo(
    () =>
      sections.map((section) => {
        const title =
          locale === 'ar'
            ? section.stageNameAr || section.stageNameEn
            : locale === 'he' && section.stageNameHe
              ? section.stageNameHe
              : section.stageNameEn;
        return {
          stageCode: section.stageCode,
          title,
          kits: section.kits,
        };
      }),
    [sections, locale],
  );

  const productName = useMemo(() => {
    if (!orderMeta) return '';
    const p = orderMeta.product;
    if (!p) return orderMeta.productDescription;
    if (locale === 'ar') return p.nameAr || p.nameEn;
    if (locale === 'he') return p.nameHe || p.nameEn;
    return p.nameEn || p.nameAr;
  }, [orderMeta, locale]);

  function openKitQr(kit: WipKitCard) {
    pendingAfterSemiDetailRef.current = { type: 'qr', kit };
    setInspectKitId(null);
  }

  function printKitQr(kit: WipKitCard) {
    pendingAfterSemiDetailRef.current = { type: 'print', kit };
    setInspectKitId(null);
  }

  function flushAfterSemiDetailClosed() {
    const pending = pendingAfterSemiDetailRef.current;
    pendingAfterSemiDetailRef.current = null;
    if (!pending) return;
    if (pending.type === 'qr') {
      setQrItem({
        id: pending.kit.id,
        sku: pending.kit.qrCode,
        name: pending.kit.productionOrder.number,
        scanCode: pending.kit.qrCode,
        category: 'SEMI_FINISHED',
        unit: 'pcs',
        imageUrl: null,
        itemClass: 'SEMI_FINISHED_GOOD',
      });
      return;
    }
    pendingPrintRef.current = {
      id: pending.kit.id,
      sku: pending.kit.qrCode,
      kind: 'wip-kit',
    };
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        await openWipKitQrLabelPdf(pending.kit.id, pending.kit.qrCode, opts);
      } catch {
        showToast({
          variant: 'error',
          message: t('mobile.inventory.wipLabelFailedBody'),
        });
      }
    })();
  }

  function flushPendingPrint() {
    const pending = pendingPrintRef.current;
    pendingPrintRef.current = null;
    if (!pending) return;
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        await openWipKitQrLabelPdf(pending.id, pending.sku, opts);
      } catch {
        showToast({
          variant: 'error',
          message: t('mobile.inventory.wipLabelFailedBody'),
        });
      }
    })();
  }

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.inventory.errorTitle')} />
      </AppScreen>
    );
  }

  const title = productName || t('mobile.inventory.semiOrderDetail');

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      {pdfDownloadSheet}
      <FlatList
        data={groups}
        keyExtractor={(row) => `stage-${row.stageCode}`}
        contentContainerStyle={{
          paddingBottom: SURFACE_TAB_BAR_CLEARANCE + theme.spacing.xl,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={boardQuery.isRefetching}
            onRefresh={() => void boardQuery.refetch()}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            {/* Back + plain title (PO then name) — no plaque box */}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                minHeight: BACK_SLOT,
              }}
            >
              <View style={{ width: BACK_SLOT, alignItems: 'center', justifyContent: 'center' }}>
                <ScreenBackLead fallback={'/(app)/(admin)/(tabs)/inventory' as Href} />
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingHorizontal: theme.spacing.sm,
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                {orderMeta ? (
                  <AppText
                    variant="caption"
                    weight="semibold"
                    dir="ltr"
                    numberOfLines={1}
                    style={{
                      color: colors.brand,
                      letterSpacing: locale === 'ar' ? 0 : 0.35,
                      fontSize: 12,
                      textAlign: 'center',
                    }}
                  >
                    {orderMeta.number}
                  </AppText>
                ) : null}
                <AppText
                  variant="title"
                  weight={titleWeight}
                  numberOfLines={2}
                  align="center"
                  style={{ textAlign: 'center' }}
                >
                  {title}
                </AppText>
              </View>
              <View style={{ width: BACK_SLOT }} />
            </View>

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
                paddingHorizontal: theme.spacing.sm,
              }}
            >
              <AppText
                variant="caption"
                color="muted"
                style={{
                  flex: 1,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {t('mobile.inventory.wipBoardHint')}
              </AppText>
              <InventoryFilterButton
                activeCount={filter === 'active' ? 0 : 1}
                onPress={() => {
                  setFilterDraft({
                    ...defaultSemiFilterDraft(historyDefaults),
                    scope: filter,
                  });
                  setFilterSheetOpen(true);
                }}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          boardQuery.isPending && !boardQuery.data ? (
            <InventoryListSkeleton />
          ) : boardQuery.isError ? (
            <ErrorState
              title={t('mobile.inventory.wipBoardError')}
              description={t('mobile.inventory.errorBody')}
              retryLabel={t('mobile.inventory.retry')}
              onRetry={() => void boardQuery.refetch()}
            />
          ) : (
            <EmptyState
              title={t('mobile.inventory.emptySemiKitsTitle')}
              description={
                filter === 'active'
                  ? t('mobile.inventory.semiOrdersEmptyActive')
                  : t('mobile.inventory.emptySemiKitsBody')
              }
            />
          )
        }
        renderItem={({ item, index }) => (
          <InventorySemiStageGroup
            title={item.title}
            kits={item.kits}
            first={index === 0}
            onPressKit={(kit) => {
              setInspectKitSeed(kit);
              setInspectKitId(kit.id);
            }}
          />
        )}
      />

      <InventorySemiOrderDetailSheet
        open={Boolean(inspectKitId)}
        kitId={inspectKitId}
        seed={inspectKitSeed}
        onClose={() => setInspectKitId(null)}
        onClosed={flushAfterSemiDetailClosed}
        onShowQr={(kit) => openKitQr(kit)}
        onPrintQr={(kit) => printKitQr(kit)}
      />
      <InventoryQrSheet
        open={Boolean(qrItem)}
        item={qrItem}
        onClose={() => setQrItem(null)}
        onClosed={flushPendingPrint}
        onPrint={
          qrItem
            ? () => {
                pendingPrintRef.current = {
                  id: qrItem.id,
                  sku: qrItem.sku,
                  kind: 'wip-kit',
                };
                setQrItem(null);
              }
            : undefined
        }
      />

      <InventorySemiFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        draft={filterDraft}
        onChange={setFilterDraft}
        warehouses={[]}
        defaults={historyDefaults}
        showWarehouse={false}
        showHistoryDates={false}
        onReset={() => {
          const next = defaultSemiFilterDraft(historyDefaults);
          setFilterDraft(next);
          setFilter(next.scope);
          setFilterSheetOpen(false);
        }}
        onApply={() => {
          setFilter(filterDraft.scope);
          setFilterSheetOpen(false);
        }}
      />
    </AppScreen>
  );
}
