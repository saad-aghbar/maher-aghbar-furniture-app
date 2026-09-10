import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { createRequestId } from '@/api/requestId';
import { listWarehouses } from '@/api/modules/inventory';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { Divider } from '@/components/layout/Divider';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { useLabelVerifyScan } from '@/features/inventory/useLabelVerifyScan';
import { locationsForWarehouse } from '@/features/inventory/components/WarehouseBinBoard';
import { pickDefaultLocationId } from '@/features/inventory/pickDefaultLocation';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DestinationPickSheet } from './components/DestinationPickSheet';
import { PurchasingFloorBoard } from './components/PurchasingFloorBoard';
import { PurchasingSkeleton } from './components/PurchasingSkeleton';
import { ReceiveFloorTrigger } from './components/ReceiveFloorTrigger';
import { ReceiveLineVerifyChip } from './components/ReceiveLineVerifyChip';
import {
  acceptedReceiveQty,
  allReceiveLinesChecked,
  applyReceiveDestinationNames,
  applyReceiveScanVerify,
  buildReceivableDrafts,
  buildReceivePayload,
  groupReceiveDraftsByWarehouse,
  receiveCheckedCount,
  receiveDestinationLabel,
  receiveDraftsForNames,
  setReceiveLineChecked,
  tryMarkReceiveLineDone,
  validateReceiveDrafts,
  type ReceiveLineDraft,
  type ReceiveLineReadyIssue,
} from './receiveLineDrafts';
import { usePurchaseActionMutation, usePurchaseOrderQuery } from './query';
import { localizedNamed } from './selectPurchase';

type Props = { orderId: string };

export function ReceiveGoodsScreen({ orderId }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale, isRTL, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const canReceive = can(user, 'inventory.receive');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/inventory/receive' as Href;
  const query = usePurchaseOrderQuery(orderId, canReceive);
  const actions = usePurchaseActionMutation(orderId);
  const warehousesQuery = useQuery({
    queryKey: ['warehouses-receive-screen'],
    queryFn: listWarehouses,
    enabled: canReceive,
  });

  const [drafts, setDrafts] = useState<ReceiveLineDraft[] | null>(null);
  const [step, setStep] = useState<'edit' | 'review' | 'done'>('edit');
  const [destOpen, setDestOpen] = useState<string | null>(null);
  const [verifyLineId, setVerifyLineId] = useState<string | null>(null);
  const [verifyMissLineId, setVerifyMissLineId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [receiptCount, setReceiptCount] = useState(0);

  const seeded = useMemo(
    () => (query.data ? buildReceivableDrafts(query.data, { includeManualFabric: true }) : []),
    [query.data],
  );
  const rawWarehouses = useMemo(
    () => (warehousesQuery.data ?? []).filter((w) => !w.type || w.type === 'RAW_MATERIALS'),
    [warehousesQuery.data],
  );
  const working = drafts ?? seeded;
  const destRow = working.find((d) => d.lineId === destOpen);
  const verifyLine = working.find((d) => d.lineId === verifyLineId);
  const { verifyBusy, runLabelVerify } = useLabelVerifyScan(verifyLine?.inventoryItemId);
  const dockPad = stickyCtaBottomInset(insets.bottom, theme.spacing.md, SURFACE_TAB_BAR_CLEARANCE) + 120;
  const issue = validateReceiveDrafts(working);
  const reviewGroups = groupReceiveDraftsByWarehouse(working);
  const allChecked = allReceiveLinesChecked(working);
  const checkedCount = receiveCheckedCount(working);

  useEffect(() => {
    if (!seeded.length) return;
    setDrafts((prev) =>
      applyReceiveDestinationNames(
        receiveDraftsForNames(prev, seeded),
        rawWarehouses,
        locale,
      ),
    );
  }, [rawWarehouses, locale, seeded]);

  const update = (lineId: string, patch: Partial<ReceiveLineDraft>) => {
    setDrafts(working.map((d) => (d.lineId === lineId ? { ...d, ...patch } : d)));
  };

  const readyIssueMessage = (readyIssue: ReceiveLineReadyIssue) => {
    if (readyIssue === 'holding') return t('mobile.purchasing.fabricNeedsLocation');
    if (readyIssue === 'over') return t('mobile.purchasing.overReceipt');
    if (readyIssue === 'warehouse') return t('mobile.purchasing.warehouseRequired');
    if (readyIssue === 'qty') return t('mobile.purchasing.zeroQtyLine');
    return t('mobile.purchasing.nothingToReceive');
  };

  const toggleLineDone = (line: ReceiveLineDraft) => {
    if (line.checked) {
      void haptics.selection();
      setDrafts(setReceiveLineChecked(working, line.lineId, false));
      return;
    }
    const result = tryMarkReceiveLineDone(working, line.lineId);
    if (result.issue) {
      void haptics.error();
      showToast({ variant: 'error', message: readyIssueMessage(result.issue) });
      return;
    }
    void haptics.confirmLight();
    setDrafts(result.drafts);
  };

  const startVerify = async (line: ReceiveLineDraft) => {
    setVerifyLineId(line.lineId);
    const outcome = await runLabelVerify(line.inventoryItemId);
    if (!outcome) return;
    if (outcome.kind === 'MATCH') {
      setVerifyMissLineId(null);
      setDrafts((prev) =>
        applyReceiveScanVerify(prev ?? seeded, line.lineId, outcome.scanned?.id ?? line.inventoryItemId),
      );
      showToast({ variant: 'success', message: t('mobile.purchasing.scanVerified') });
      return;
    }
    setVerifyMissLineId(line.lineId);
    setDrafts((prev) => applyReceiveScanVerify(prev ?? seeded, line.lineId, null));
    showToast({ variant: 'error', message: t('mobile.purchasing.scanVerifyMiss') });
  };

  const confirm = () => {
    if (step === 'edit' && !allChecked) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.purchasing.reviewNeedsAllLines') });
      return;
    }
    if (issue) {
      void haptics.error();
      const message =
        issue === 'holding'
          ? t('mobile.purchasing.fabricNeedsLocation')
          : issue === 'over'
            ? t('mobile.purchasing.overReceipt')
            : t('mobile.purchasing.nothingToReceive');
      showToast({ variant: 'error', message });
      return;
    }
    if (step === 'edit') {
      void haptics.selection();
      setStep('review');
      return;
    }
    actions.receive.mutate(
      buildReceivePayload(working, {
        notes: notes.trim() || undefined,
        idempotencyKey: `grn-${orderId}-${createRequestId()}`,
      }),
      {
        onSuccess: (res) => {
          const receipts =
            res && typeof res === 'object' && 'receipts' in res
              ? (res as { receipts?: unknown[] }).receipts
              : undefined;
          void haptics.confirmMedium();
          setReceiptCount(Array.isArray(receipts) ? receipts.length : 1);
          setStep('done');
          showToast({ variant: 'success', message: t('mobile.purchasing.receiveSuccess') });
        },
        onError: (err) => {
          void haptics.error();
          showToast({
            variant: 'error',
            message: isApiError(err) ? toastMessageForError(err) : t('mobile.purchasing.receiveFailed'),
          });
        },
      },
    );
  };

  if (!canReceive) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }
  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={backFallback}>
        <ErrorState
          title={t('mobile.purchasing.errorTitle')}
          description={t('mobile.purchasing.errorBody')}
          retryLabel={t('mobile.purchasing.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }
  if (!query.data) {
    return (
      <AppScreen backFallback={backFallback}>
        <PurchasingSkeleton />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={backFallback}>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: dockPad }}>
        <AppText variant="largeTitle" weight={titleWeight} align="center">
          {step === 'done'
            ? t('mobile.purchasing.receiveResult')
            : t('mobile.purchasing.receiveScreenTitle')}
        </AppText>
        <PurchasingFloorBoard title={query.data.number}>
          <View
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm + 2,
            }}
          >
            <AppText weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {localizedNamed(locale, query.data.supplier)}
            </AppText>
            {step === 'edit' && working.length > 0 ? (
              <AppText
                variant="caption"
                color="muted"
                style={{ marginTop: theme.spacing.xs, textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('mobile.purchasing.receiveChecklistProgress', {
                  done: String(checkedCount.done),
                  total: String(checkedCount.total),
                })}
              </AppText>
            ) : null}
          </View>
        </PurchasingFloorBoard>

        {step === 'done' ? (
          <PurchasingFloorBoard>
            <AppText>
              {t('mobile.purchasing.receiptsCreated', { count: String(receiptCount) })}
            </AppText>
            <SecondaryButton
              label={t('mobile.purchasing.resultOpenOrder')}
              onPress={() => router.replace(`/(app)/(admin)/purchasing/${orderId}` as Href)}
              style={{ borderRadius: theme.radius.full, minHeight: theme.sizes.touch.min }}
            />
          </PurchasingFloorBoard>
        ) : null}

        {step === 'edit'
          ? working.map((line, index) => {
              const destLabel = receiveDestinationLabel(line);
              const destMissing = !line.warehouseId || !line.locationId;
              const accepted = acceptedReceiveQty(line.receiveNow, line.rejectedQty);
              return (
                <ListItemEnter key={line.lineId} index={index}>
                  <PurchasingFloorBoard
                    title={line.description}
                    headerAccent={line.checked}
                    trailing={
                      line.checked ? (
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: colors.successSoft,
                            borderWidth: 1,
                            borderColor: colors.success,
                          }}
                        >
                          <Ionicons name="checkmark" size={16} color={colors.success} />
                        </View>
                      ) : null
                    }
                    contentStyle={{ gap: theme.spacing.sm }}
                  >
                    <View
                      style={{
                        borderRadius: theme.radius.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceSecondary,
                        overflow: 'hidden',
                      }}
                    >
                      {line.sku ? (
                        <>
                          <MetaRow label={t('catalog.sku')} value={line.sku} valueLtr />
                          <Divider compact plain />
                        </>
                      ) : null}
                      <MetaRow
                        label={t('mobile.purchasing.orderedQty')}
                        value={`${line.orderedQty} ${line.unit}`}
                        valueLtr
                      />
                      <Divider compact plain />
                      <MetaRow
                        label={t('mobile.purchasing.remaining')}
                        value={`${line.remaining} ${line.unit}`}
                        valueLtr
                      />
                    </View>
                    <QtyStepperField
                      label={t('mobile.purchasing.receiveNow')}
                      value={line.receiveNow}
                      onChangeText={(v) => update(line.lineId, { receiveNow: v })}
                      max={line.remaining}
                      disabled={line.checked}
                    />
                    <QtyStepperField
                      label={t('mobile.purchasing.rejectedQty')}
                      value={line.rejectedQty}
                      onChangeText={(v) => update(line.lineId, { rejectedQty: v })}
                      disabled={line.checked}
                    />
                    <View
                      style={{
                        borderRadius: theme.radius.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceSecondary,
                        overflow: 'hidden',
                      }}
                    >
                      <MetaRow
                        label={t('mobile.purchasing.unitCost')}
                        value={formatCurrency(Number(line.unitCost) || 0)}
                        valueLtr
                      />
                      <Divider compact plain />
                      <MetaRow
                        label={t('mobile.purchasing.acceptedNow')}
                        value={`${accepted} ${line.unit}`}
                        valueLtr
                      />
                    </View>
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {t('mobile.purchasing.unitCostFromInventory')}
                    </AppText>
                    <ReceiveFloorTrigger
                      icon={line.isFabric ? 'location-outline' : 'cube-outline'}
                      label={
                        line.warehouseName ||
                        destLabel ||
                        (line.isFabric
                          ? t('mobile.purchasing.pickHoldingLocation')
                          : t('mobile.purchasing.pickWarehouse'))
                      }
                      caption={line.locationName}
                      active={Boolean(destLabel)}
                      warning={destMissing && !line.checked}
                      disabled={line.checked}
                      onPress={() => {
                        if (line.checked) return;
                        setDestOpen(line.lineId);
                      }}
                    />
                    <ReceiveLineVerifyChip
                      verified={line.verified}
                      busy={verifyBusy && verifyLineId === line.lineId}
                      miss={verifyMissLineId === line.lineId && !line.verified}
                      disabled={line.checked}
                      onPress={() => {
                        if (line.checked) return;
                        void startVerify(line);
                      }}
                    />
                    <ReceiveFloorTrigger
                      icon={line.checked ? 'checkbox' : 'square-outline'}
                      label={
                        line.checked
                          ? t('mobile.purchasing.lineReceived')
                          : t('mobile.purchasing.markLineReceived')
                      }
                      success={line.checked}
                      onPress={() => toggleLineDone(line)}
                    />
                    {line.checked ? (
                      <AppText
                        variant="caption"
                        color="muted"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      >
                        {t('mobile.purchasing.editReceivedLine')}
                      </AppText>
                    ) : null}
                  </PurchasingFloorBoard>
                </ListItemEnter>
              );
            })
          : null}

        {step === 'review'
          ? reviewGroups.map((group, index) => (
              <ListItemEnter key={group.warehouseId} index={index}>
                <PurchasingFloorBoard title={group.label} contentStyle={{ gap: theme.spacing.sm }}>
                  {group.lines.map((line) => (
                    <View
                      key={line.lineId}
                      style={{
                        borderRadius: theme.radius.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceSecondary,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: theme.spacing.md,
                          paddingTop: theme.spacing.md,
                          paddingBottom: theme.spacing.sm,
                        }}
                      >
                        <AppText weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
                          {line.description}
                        </AppText>
                      </View>
                      <Divider compact plain />
                      <MetaRow
                        label={t('mobile.purchasing.receiveNow')}
                        value={`${line.receiveNow} ${line.unit}`}
                        valueLtr
                      />
                      {receiveDestinationLabel(line) ? (
                        <>
                          <Divider compact plain />
                          <MetaRow
                            label={
                              line.isFabric
                                ? t('mobile.purchasing.holdingPlace')
                                : t('mobile.purchasing.warehouse')
                            }
                            value={receiveDestinationLabel(line)}
                          />
                        </>
                      ) : null}
                      {line.verified ? (
                        <>
                          <Divider compact plain />
                          <MetaRow
                            label={t('mobile.purchasing.scanToVerify')}
                            value={t('mobile.purchasing.scanVerified')}
                          />
                        </>
                      ) : null}
                    </View>
                  ))}
                </PurchasingFloorBoard>
              </ListItemEnter>
            ))
          : null}

        {step !== 'done' ? (
          <PurchasingFloorBoard title={t('mobile.purchasing.notes')}>
            <TextField
              label={t('mobile.purchasing.notes')}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </PurchasingFloorBoard>
        ) : null}
      </ScrollView>

      {step !== 'done' ? (
        <FloatingActionDock>
          {step === 'edit' && !allChecked ? (
            <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
              {t('mobile.purchasing.reviewNeedsAllLines')}
            </AppText>
          ) : null}
          <PrimaryButton
            label={
              step === 'review'
                ? t('mobile.purchasing.confirmReceive')
                : t('mobile.purchasing.reviewReceive')
            }
            loading={actions.receive.isPending}
            disabled={actions.receive.isPending || (step === 'edit' && !allChecked)}
            onPress={confirm}
            style={{ borderRadius: theme.radius.full, minHeight: theme.sizes.touch.min }}
          />
        </FloatingActionDock>
      ) : null}

      <DestinationPickSheet
        open={Boolean(destOpen)}
        onClose={() => setDestOpen(null)}
        mode={destRow?.isFabric ? 'location' : 'warehouse'}
        warehouses={rawWarehouses}
        selectedWarehouseId={destRow?.warehouseId ?? ''}
        selectedLocationId={destRow?.locationId}
        onSelectWarehouse={(id) => {
          if (!destOpen) return;
          const named = applyReceiveDestinationNames(
            working.map((row) =>
              row.lineId === destOpen
                ? {
                    ...row,
                    warehouseId: id,
                    locationId: row.isFabric
                      ? row.locationId
                      : pickDefaultLocationId(locationsForWarehouse(rawWarehouses.find((wh) => wh.id === id))),
                  }
                : row,
            ),
            rawWarehouses,
            locale,
          ).find((row) => row.lineId === destOpen);
          update(destOpen, {
            warehouseId: id,
            warehouseName: named?.warehouseName,
            locationId:
              destRow?.isFabric
                ? destRow.locationId
                : pickDefaultLocationId(
                    locationsForWarehouse(rawWarehouses.find((wh) => wh.id === id)),
                    destRow?.locationId,
                  ),
          });
        }}
        onSelectLocation={(id, warehouseId) => {
          if (!destOpen) return;
          const named = applyReceiveDestinationNames(
            working.map((row) =>
              row.lineId === destOpen ? { ...row, locationId: id, warehouseId } : row,
            ),
            rawWarehouses,
            locale,
          ).find((row) => row.lineId === destOpen);
          update(destOpen, {
            locationId: id,
            warehouseId,
            locationName: named?.locationName,
            warehouseName: named?.warehouseName,
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
