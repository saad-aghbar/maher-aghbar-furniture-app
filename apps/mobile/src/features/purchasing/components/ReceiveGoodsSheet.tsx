import { useEffect, useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { createRequestId } from '@/api/requestId';
import { listWarehouses, type Warehouse } from '@/api/modules/inventory';
import type { GoodsReceiptInput, PurchaseOrder } from '@/api/modules/purchasing';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { TextField } from '@/components/forms/TextField';
import { useCodeScanner } from '@/components/scan/CodeScannerProvider';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { WarehousePickList } from '@/features/inventory/components/WarehousePickList';
import { resolveInventoryScan } from '@/features/inventory/resolveInventoryScan';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { PurchasingFloorBoard } from './PurchasingFloorBoard';

type LineDraft = {
  lineId: string;
  inventoryItemId: string;
  description: string;
  unit: string;
  orderedQty: number;
  alreadyReceived: number;
  remaining: number;
  receiveNow: string;
  rejectedQty: string;
  unitCost: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  order: PurchaseOrder;
  submitting?: boolean;
  onSubmit: (body: GoodsReceiptInput) => void;
};

function toNum(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildDrafts(order: PurchaseOrder): LineDraft[] {
  return (order.lines ?? [])
    .filter((l) => l.inventoryItemId)
    .map((l) => {
      const ordered = toNum(l.quantity);
      const already = toNum(l.receivedQty);
      const remaining =
        l.remainingQty != null ? toNum(l.remainingQty) : Math.max(0, ordered - already);
      return {
        lineId: l.id ?? l.inventoryItemId!,
        inventoryItemId: l.inventoryItemId!,
        description: l.description,
        unit: l.unit || l.inventoryItem?.unit || 'pcs',
        orderedQty: ordered,
        alreadyReceived: already,
        remaining,
        receiveNow: remaining > 0 ? String(remaining) : '0',
        rejectedQty: '0',
        unitCost: String(toNum(l.unitPrice)),
      };
    })
    .filter((l) => l.remaining > 0);
}

function isRawWarehouse(wh: Warehouse): boolean {
  if (!wh.type) return true;
  return wh.type === 'RAW_MATERIALS';
}

function lineValid(d: LineDraft): boolean {
  const received = toNum(d.receiveNow);
  const rejected = toNum(d.rejectedQty);
  const cost = toNum(d.unitCost);
  if (received < 0 || rejected < 0) return false;
  if (rejected > received + 1e-9) return false;
  const accepted = received - rejected;
  if (accepted > d.remaining + 1e-9) return false;
  return Number.isFinite(cost) && cost >= 0;
}

export function ReceiveGoodsSheet({ open, onClose, order, submitting, onSubmit }: Props) {
  const { t, formatCurrency, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { openScanner } = useCodeScanner();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.92), 780);
  const warehouseListHeight = Math.round(height * 0.18);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [drafts, setDrafts] = useState<LineDraft[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const warehousesQuery = useQuery({
    queryKey: ['warehouses-receive-sheet'],
    queryFn: listWarehouses,
    enabled: open,
  });

  const rawWarehouses = useMemo(
    () => (warehousesQuery.data ?? []).filter(isRawWarehouse),
    [warehousesQuery.data],
  );

  useEffect(() => {
    if (!open) {
      setStep('edit');
      setDrafts([]);
      setWarehouseId('');
      setLocationId('');
      setIdempotencyKey('');
      setFocusedLineId(null);
      setScanning(false);
      return;
    }
    setStep('edit');
    setDrafts(buildDrafts(order));
    setIdempotencyKey(`grn-${order.id}-${createRequestId()}`);
    setFocusedLineId(null);
    const preferred =
      order.warehouseId &&
      (warehousesQuery.data ?? []).some((w) => w.id === order.warehouseId && isRawWarehouse(w))
        ? order.warehouseId
        : '';
    setWarehouseId(preferred);
  }, [open, order.id, order.lines, order.warehouseId, warehousesQuery.data]);

  useEffect(() => {
    if (!open || warehouseId) return;
    const first = rawWarehouses[0]?.id;
    if (first) setWarehouseId(first);
  }, [open, warehouseId, rawWarehouses]);

  const receivable = drafts.filter((d) => toNum(d.receiveNow) > 0);
  const canReview =
    Boolean(warehouseId) && receivable.length > 0 && drafts.every(lineValid);

  const warehouseLabel = useMemo(() => {
    const wh = rawWarehouses.find((w) => w.id === warehouseId);
    if (!wh) return '—';
    const name = locale === 'ar' ? wh.nameAr || wh.nameEn : wh.nameEn || wh.nameAr;
    return `${wh.code} — ${name}`;
  }, [rawWarehouses, warehouseId, locale]);

  const dismiss = () => onClose();

  const goReview = () => {
    if (!canReview) return;
    void haptics.selection();
    setStep('review');
  };

  const confirm = () => {
    if (!warehouseId || receivable.length === 0) return;
    void haptics.confirmMedium();
    onSubmit({
      warehouseId,
      locationId: locationId || undefined,
      idempotencyKey: idempotencyKey || `grn-${order.id}-${createRequestId()}`,
      lines: receivable.map((d) => ({
        inventoryItemId: d.inventoryItemId,
        orderedQty: d.orderedQty,
        receivedQty: toNum(d.receiveNow),
        rejectedQty: toNum(d.rejectedQty) || 0,
        unitCost: toNum(d.unitCost),
      })),
    });
  };

  const updateDraft = (
    lineId: string,
    patch: Partial<Pick<LineDraft, 'receiveNow' | 'rejectedQty' | 'unitCost'>>,
  ) => {
    setDrafts((prev) => prev.map((d) => (d.lineId === lineId ? { ...d, ...patch } : d)));
  };

  /** Lightweight SELECT-style scan — focuses matching line; no ScanInventoryItemAction (QR matrix). */
  const scanToFocusLine = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const code = await openScanner({
        title: t('mobile.purchasing.scanToFocusLine'),
        hint: t('mobile.inventory.scanBarcodeHint'),
      });
      if (!code) return;
      void haptics.selection();
      const resolved = await resolveInventoryScan(code);
      // A fabric bundle QR still identifies a real material — focus its line.
      const scannedItemId =
        resolved.status === 'FOUND'
          ? resolved.item.id
          : resolved.status === 'ORDER_FABRIC'
            ? resolved.lot.inventoryItem.id
            : null;
      if (!scannedItemId) {
        void haptics.error();
        setScanNote(t('mobile.purchasing.scanNoLineMatch'));
        return;
      }
      const match = drafts.find((d) => d.inventoryItemId === scannedItemId);
      if (!match) {
        void haptics.error();
        setScanNote(t('mobile.purchasing.scanNoLineMatch'));
        return;
      }
      setScanNote(null);
      setFocusedLineId(match.lineId);
      void haptics.confirmLight();
    } finally {
      setScanning(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={dismiss}
      title={
        step === 'review'
          ? t('mobile.purchasing.reviewReceive')
          : t('mobile.purchasing.receive')
      }
      sheetHeight={sheetHeight}
    >
      <View style={{ flex: 1, minHeight: 0, gap: theme.spacing.md }}>
        {drafts.length === 0 ? (
          <AppText color="muted" style={{ textAlign: 'center' }}>
            {t('mobile.purchasing.nothingToReceive')}
          </AppText>
        ) : step === 'edit' ? (
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}
          >
            <AppText
              variant="caption"
              color="secondary"
              style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 18 }}
            >
              {t('mobile.purchasing.receiveLinesHint')}
            </AppText>

            <SecondaryButton
              label={t('mobile.purchasing.scanToFocusLine')}
              onPress={() => void scanToFocusLine()}
              disabled={scanning}
              style={{ borderRadius: theme.radius.xl }}
            />

            {scanNote ? (
              <AppText
                variant="caption"
                style={{ color: colors.warning, textAlign: isRTL ? 'right' : 'left' }}
              >
                {scanNote}
              </AppText>
            ) : null}

            <View style={{ gap: theme.spacing.sm }}>
              <AppText
                variant="caption"
                weight={titleWeight}
                style={{ textAlign: isRTL ? 'right' : 'left', color: colors.brand }}
              >
                {t('mobile.purchasing.selectRawWarehouse')}
              </AppText>
              <WarehousePickList
                warehouses={rawWarehouses}
                selectedId={warehouseId}
                onSelect={(id) => {
                  setWarehouseId(id);
                  setLocationId('');
                }}
                listHeight={warehouseListHeight}
                resetToken={open}
              />
            </View>
            {(() => {
              const locs = rawWarehouses.find((w) => w.id === warehouseId)?.locations ?? [];
              if (!locs.length) return null;
              return (
                <View style={{ gap: theme.spacing.sm }}>
                  <AppText
                    variant="caption"
                    weight={titleWeight}
                    style={{ textAlign: isRTL ? 'right' : 'left', color: colors.brand }}
                  >
                    {t('mobile.purchasing.holdingLocation')}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {t('mobile.purchasing.holdingLocationHint')}
                  </AppText>
                  {locs.map((loc) => (
                    <AnimatedPressable
                      key={loc.id}
                      variant="button"
                      onPress={() => setLocationId(loc.id)}
                      style={{
                        paddingVertical: theme.spacing.sm,
                        paddingHorizontal: theme.spacing.md,
                        borderRadius: theme.radius.lg,
                        borderWidth: 1,
                        borderColor: locationId === loc.id ? colors.brand : colors.border,
                        backgroundColor: locationId === loc.id ? colors.brandSoft : colors.surfaceSecondary,
                      }}
                    >
                      <AppText weight={locationId === loc.id ? titleWeight : 'regular'}>
                        {loc.name?.trim() || loc.code}
                      </AppText>
                    </AnimatedPressable>
                  ))}
                </View>
              );
            })()}

            {drafts.map((line) => {
              const focused = focusedLineId === line.lineId;
              return (
                <PurchasingFloorBoard
                  key={line.lineId}
                  title={line.description}
                  style={
                    focused
                      ? {
                          borderColor: colors.brand,
                          borderWidth: 1.5,
                          backgroundColor: colors.brandSoft,
                        }
                      : undefined
                  }
                >
                  <MetaRow
                    label={t('mobile.purchasing.orderedQty')}
                    value={`${line.orderedQty} ${line.unit}`}
                    isRTL={isRTL}
                  />
                  <MetaRow
                    label={t('mobile.purchasing.alreadyReceived')}
                    value={`${line.alreadyReceived} ${line.unit}`}
                    isRTL={isRTL}
                  />
                  <MetaRow
                    label={t('mobile.purchasing.remaining')}
                    value={`${line.remaining} ${line.unit}`}
                    isRTL={isRTL}
                  />
                  <TextField
                    label={t('mobile.purchasing.receiveNow')}
                    value={line.receiveNow}
                    onChangeText={(v) => updateDraft(line.lineId, { receiveNow: v })}
                    keyboardType="decimal-pad"
                  />
                  <TextField
                    label={t('mobile.purchasing.rejectedQty')}
                    value={line.rejectedQty}
                    onChangeText={(v) => updateDraft(line.lineId, { rejectedQty: v })}
                    keyboardType="decimal-pad"
                  />
                  <TextField
                    label={t('mobile.purchasing.unitCostActual')}
                    value={line.unitCost}
                    onChangeText={(v) => updateDraft(line.lineId, { unitCost: v })}
                    keyboardType="decimal-pad"
                  />
                </PurchasingFloorBoard>
              );
            })}
          </ScrollView>
        ) : (
          <ScrollView
            nestedScrollEnabled
            contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}
          >
            <PurchasingFloorBoard>
              <MetaRow
                label={t('mobile.purchasing.warehouse')}
                value={warehouseLabel}
                isRTL={isRTL}
              />
            </PurchasingFloorBoard>
            {receivable.map((line) => (
              <PurchasingFloorBoard key={line.lineId} title={line.description}>
                <MetaRow
                  label={t('mobile.purchasing.receiveNow')}
                  value={`${toNum(line.receiveNow)} ${line.unit}`}
                  isRTL={isRTL}
                />
                <MetaRow
                  label={t('mobile.purchasing.rejectedQty')}
                  value={`${toNum(line.rejectedQty)} ${line.unit}`}
                  isRTL={isRTL}
                />
                <MetaRow
                  label={t('mobile.purchasing.unitCostActual')}
                  value={formatCurrency(toNum(line.unitCost))}
                  isRTL={isRTL}
                />
                <MetaRow
                  label={t('mobile.purchasing.lineTotal')}
                  value={formatCurrency(
                    Math.max(0, toNum(line.receiveNow) - toNum(line.rejectedQty)) *
                      toNum(line.unitCost),
                  )}
                  isRTL={isRTL}
                />
              </PurchasingFloorBoard>
            ))}
          </ScrollView>
        )}

        <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xs }}>
          {step === 'edit' ? (
            <>
              <PrimaryButton
                label={t('mobile.purchasing.reviewReceive')}
                onPress={goReview}
                disabled={!canReview}
                style={{ borderRadius: theme.radius.xl }}
              />
              <SecondaryButton
                label={t('mobile.purchasing.cancel')}
                onPress={dismiss}
                style={{ borderRadius: theme.radius.xl }}
              />
            </>
          ) : (
            <>
              <PrimaryButton
                label={t('mobile.purchasing.confirmReceive')}
                onPress={confirm}
                loading={submitting}
                style={{ borderRadius: theme.radius.xl }}
              />
              <SecondaryButton
                label={t('common.back')}
                onPress={() => setStep('edit')}
                disabled={submitting}
                style={{ borderRadius: theme.radius.xl }}
              />
            </>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}

function MetaRow({
  label,
  value,
  isRTL,
}: {
  label: string;
  value: string;
  isRTL: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </AppText>
      <AppText weight="semibold" dir="ltr" style={{ textAlign: isRTL ? 'left' : 'right' }}>
        {value}
      </AppText>
    </View>
  );
}
