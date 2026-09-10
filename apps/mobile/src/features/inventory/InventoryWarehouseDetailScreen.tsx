import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can, canAny } from '@maher/permissions';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import type { Warehouse, WarehouseDeskLocation } from './api';
import { openWarehouseLocationQrLabelPdf } from './api';
import { BinContentsSheet } from './components/BinContentsSheet';
import { HoldingLocationFormSheet } from './components/HoldingLocationFormSheet';
import type { HoldingLocationOption } from './components/HoldingLocationBox';
import { InventoryBoardCard } from './components/InventoryBoardCard';
import { InventoryIdentityBoard } from './components/InventoryIdentityBoard';
import { InventoryQrSheet, type InventoryQrItem } from './components/InventoryQrSheet';
import { InventoryDetailSkeleton } from './components/InventorySkeleton';
import { locationPickerLabel, sortBinsForPicker } from './pickDefaultLocation';
import {
  useUpdateWarehouseLocationMutation,
  useWarehouseDeskQuery,
} from './query';
import {
  binStockSummary,
  deskLocationToBinContents,
  formatWarehouseQty,
  warehouseDisplayName,
  warehouseTypeKey,
} from './warehouseDesk';

type Props = {
  warehouseId: string;
};

const listFallback = '/(app)/(admin)/inventory/warehouses' as Href;

export function InventoryWarehouseDetailScreen({ warehouseId }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const allowed = canAny(user, [
    'warehouse.read',
    'warehouse.manage',
    'inventory.read',
    'inventory.receive',
  ]);
  const canManageBins = canAny(user, ['warehouse.manage', 'inventory.receive']);
  const canPrint = can(user, 'inventory.read') || can(user, 'warehouse.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const deskQuery = useWarehouseDeskQuery(warehouseId, allowed);
  const updateMutation = useUpdateWarehouseLocationMutation();

  const [binForm, setBinForm] = useState<'add' | HoldingLocationOption | null>(null);
  const [inspectLoc, setInspectLoc] = useState<WarehouseDeskLocation | null>(null);
  const [qrLoc, setQrLoc] = useState<WarehouseDeskLocation | null>(null);

  const desk = deskQuery.data;
  const name = desk ? warehouseDisplayName(desk, locale) : '';
  const typeLabel = t(`mobile.inventory.warehouseTypes.${warehouseTypeKey(desk?.type)}`);
  const bins = useMemo(
    () => sortBinsForPicker(desk?.locations ?? []),
    [desk?.locations],
  );
  const warehouseForForm: Warehouse | null = desk
    ? {
        id: desk.id,
        code: desk.code,
        nameEn: desk.nameEn,
        nameAr: desk.nameAr,
        type: desk.type,
        isDefault: desk.isDefault,
        locations: desk.locations,
      }
    : null;

  const dockPad =
    stickyCtaBottomInset(insets.bottom, theme.spacing.md, SURFACE_TAB_BAR_CLEARANCE) +
    (canManageBins ? 72 : 0);

  function fail(err: unknown) {
    void haptics.error();
    showToast({
      variant: 'error',
      message: isApiError(err) ? toastMessageForError(err) : t('mobile.inventory.itemUpdateFailed'),
    });
  }

  function setBinActive(loc: WarehouseDeskLocation, isActive: boolean) {
    updateMutation.mutate(
      { warehouseId, locationId: loc.id, body: { isActive } },
      {
        onSuccess: () => {
          void haptics.confirmLight();
          showToast({
            variant: 'success',
            message: isActive
              ? t('mobile.inventory.binActivated')
              : t('mobile.inventory.binDeactivated'),
          });
        },
        onError: fail,
      },
    );
  }

  function confirmDeactivate(loc: WarehouseDeskLocation) {
    Alert.alert(t('mobile.inventory.deactivateBinTitle'), t('mobile.inventory.deactivateBinConfirm'), [
      { text: t('mobile.inventory.cancel'), style: 'cancel' },
      {
        text: t('mobile.inventory.deactivateBin'),
        style: 'destructive',
        onPress: () => setBinActive(loc, false),
      },
    ]);
  }

  async function printBin(loc: WarehouseDeskLocation) {
    const opts = await pickPdfOptions();
    if (!opts) return;
    try {
      await openWarehouseLocationQrLabelPdf(warehouseId, loc.id, loc.code, opts);
    } catch (err) {
      fail(err);
    }
  }

  const inspectBin = desk && inspectLoc ? deskLocationToBinContents(desk, inspectLoc) : null;
  const qrItem: InventoryQrItem | null = qrLoc
    ? {
        id: qrLoc.id,
        sku: qrLoc.code,
        name: locationPickerLabel(qrLoc) || name,
        scanCode: qrLoc.scanCode ?? qrLoc.qrCode ?? '',
        category: '',
        unit: '',
        imageUrl: null,
      }
    : null;

  if (!allowed) {
    return (
      <AppScreen backFallback={listFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (deskQuery.isError && !desk) {
    return (
      <AppScreen backFallback={listFallback}>
        <ErrorState
          title={t('mobile.inventory.errorTitle')}
          description={t('mobile.inventory.errorBody')}
          retryLabel={t('mobile.inventory.retry')}
          onRetry={() => void deskQuery.refetch()}
        />
      </AppScreen>
    );
  }

  if (deskQuery.isLoading && !desk) {
    return (
      <AppScreen backFallback={listFallback}>
        <InventoryDetailSkeleton />
      </AppScreen>
    );
  }

  if (!desk) {
    return (
      <AppScreen backFallback={listFallback}>
        <EmptyState title={t('mobile.inventory.warehousesEmpty')} />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={listFallback}>
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: dockPad }}
        refreshControl={
          <RefreshControl
            refreshing={deskQuery.isRefetching && !deskQuery.isLoading}
            onRefresh={() => void deskQuery.refetch()}
            tintColor={colors.brand}
          />
        }
      >
        <AppText variant="largeTitle" weight={titleWeight} align="center" numberOfLines={2}>
          {name}
        </AppText>

        <ListItemEnter index={0}>
          <InventoryIdentityBoard
            name={name}
            sku={desk.code}
            meta={typeLabel}
            status={desk.isDefault ? 'READY' : warehouseTypeKey(desk.type)}
            statusLabel={
              desk.isDefault ? t('mobile.inventory.warehouseDefault') : typeLabel
            }
            accent={colors.brand}
            icon="business-outline"
          />
        </ListItemEnter>

        {bins.length === 0 ? (
          <DealerEmptyPanel nested icon="file-tray-outline" text={t('mobile.inventory.warehouseDeskEmptyBins')} />
        ) : (
          bins.map((loc, index) => {
            const summary = binStockSummary(loc.contents ?? []);
            const inactive = loc.isActive === false;
            return (
              <ListItemEnter key={loc.id} index={index + 1}>
                <AnimatedPressable
                  variant="card"
                  accessibilityRole="button"
                  accessibilityLabel={locationPickerLabel(loc)}
                  onPress={() => {
                    void haptics.selection();
                    setInspectLoc(loc);
                  }}
                >
                  <InventoryBoardCard
                    title={locationPickerLabel(loc)}
                    trailing={
                      loc.isDefault ? (
                        <StatusBadge
                          status="READY"
                          label={t('mobile.inventory.binDefault')}
                          branded
                          dot
                        />
                      ) : inactive ? (
                        <StatusBadge
                          status="INACTIVE"
                          label={t('mobile.inventory.inactiveMaterial')}
                          dot
                        />
                      ) : null
                    }
                    style={inactive ? { opacity: 0.72 } : undefined}
                  >
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {[
                        t('mobile.inventory.warehouseBinSkuCount', {
                          count: String(summary.skuCount),
                        }),
                        t('mobile.inventory.warehouseBinQty', {
                          qty: formatWarehouseQty(summary.qty),
                        }),
                      ].join(' · ')}
                    </AppText>

                  {canManageBins || canPrint ? (
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        flexWrap: 'wrap',
                        gap: theme.spacing.sm,
                      }}
                    >
                      {canManageBins ? (
                        <FloorChip
                          label={t('mobile.inventory.edit')}
                          onPress={() =>
                            setBinForm({
                              id: loc.id,
                              warehouseId,
                              code: loc.code,
                              name: loc.name,
                              label: locationPickerLabel(loc),
                              warehouseLabel: name,
                            })
                          }
                        />
                      ) : null}
                      {canManageBins && loc.isDefault !== true && !inactive ? (
                        <FloorChip
                          label={t('mobile.inventory.deactivateBin')}
                          onPress={() => confirmDeactivate(loc)}
                        />
                      ) : null}
                      {canManageBins && inactive ? (
                        <FloorChip
                          label={t('mobile.inventory.activateBin')}
                          onPress={() => setBinActive(loc, true)}
                        />
                      ) : null}
                      {canPrint ? (
                        <FloorChip
                          label={t('mobile.inventory.viewQr')}
                          onPress={() => {
                            void haptics.selection();
                            setQrLoc(loc);
                          }}
                        />
                      ) : null}
                    </View>
                  ) : null}
                  </InventoryBoardCard>
                </AnimatedPressable>
              </ListItemEnter>
            );
          })
        )}
      </ScrollView>

      {canManageBins ? (
        <FloatingActionDock floating>
          <PrimaryButton
            label={t('mobile.inventory.addBin')}
            onPress={() => {
              void haptics.selection();
              setBinForm('add');
            }}
            style={{ borderRadius: theme.radius.full, minHeight: 44 }}
          />
        </FloatingActionDock>
      ) : null}

      {warehouseForForm ? (
        <HoldingLocationFormSheet
          open={binForm != null}
          copy="bin"
          lockWarehouseId={warehouseId}
          warehouses={[warehouseForForm]}
          editing={binForm && binForm !== 'add' ? binForm : null}
          defaultWarehouseId={warehouseId}
          onClose={() => setBinForm(null)}
          onSaved={() => {
            setBinForm(null);
            void deskQuery.refetch();
          }}
        />
      ) : null}

      <BinContentsSheet
        open={inspectBin != null}
        bin={inspectBin}
        onClose={() => setInspectLoc(null)}
        onPrintLabel={
          inspectLoc && canPrint
            ? () => {
                void printBin(inspectLoc);
              }
            : undefined
        }
        onViewItem={(itemId) => {
          setInspectLoc(null);
          router.push(`/(app)/(admin)/inventory/items/${itemId}` as Href);
        }}
      />

      <InventoryQrSheet
        open={qrItem != null}
        item={qrItem}
        onClose={() => setQrLoc(null)}
        onPrint={
          qrLoc && canPrint
            ? () => {
                void printBin(qrLoc);
              }
            : undefined
        }
      />
      {pdfDownloadSheet}
    </AppScreen>
  );
}

function FloorChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { locale } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 40,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <AppText
        variant="caption"
        weight={locale === 'ar' ? 'medium' : 'semibold'}
        style={{ color: colors.textPrimary }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
