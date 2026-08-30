import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createRequestId } from '@/api/requestId';
import { ApiError } from '@/api/errors';
import {
  getTaskWipEligible,
  getTaskWipIncoming,
  receiveTaskWip,
  reportTaskWipDiscrepancy,
  type WipDiscrepancyCategory,
  type WipEligibleKit,
  type WipIncomingLane,
  type WipIncomingLine,
  type WipIncomingStatusKey,
  type WipWhereHint,
} from '@/api/modules/tasks';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import { AppText } from '@/components/AppText';
import { CodeField } from '@/components/forms/CodeField';
import { TextField } from '@/components/forms/TextField';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type TaskIncomingFloorHandle = {
  /** Open receive sheet for first eligible line (dock CTA). */
  openReceive: () => void;
  /** Latest availability snapshot. */
  getAvailability: () => {
    required: boolean;
    allReceived: boolean;
    lines: WipIncomingLine[];
  };
};

type Props = {
  taskId: string;
  enabled?: boolean;
  /** When true, omit outer card chrome (parent provides stamp). */
  embedded?: boolean;
  /** When true and !required, still render “None” for first-stage clarity. */
  showNoneWhenEmpty?: boolean;
  onReceived?: () => void;
  onAvailabilityChange?: (info: {
    required: boolean;
    allReceived: boolean;
    lines: WipIncomingLine[];
  }) => void;
};

const DISCREPANCY_CATEGORIES: WipDiscrepancyCategory[] = [
  'MISSING_COMPONENT',
  'WRONG_COMPONENT',
  'DAMAGED',
  'QUANTITY_MISMATCH',
  'OTHER',
];

function statusLabelKey(key: WipIncomingStatusKey): string {
  switch (key) {
    case 'WAITING_PRODUCTION':
      return 'mobile.tasks.incomingStatusWaiting';
    case 'READY_TO_COLLECT':
      return 'mobile.tasks.incomingStatusReady';
    case 'PARTIALLY_RECEIVED':
      return 'mobile.tasks.incomingStatusPartial';
    case 'RECEIVED':
      return 'mobile.tasks.incomingStatusReceived';
    default:
      return 'mobile.tasks.incomingStatusWaiting';
  }
}

function stageName(
  line: {
    fromStageNameEn: string;
    fromStageNameAr?: string | null;
    fromStageNameHe?: string | null;
  },
  locale: string,
): string {
  if (locale.startsWith('ar')) return line.fromStageNameAr || line.fromStageNameEn;
  if (locale.startsWith('he')) return line.fromStageNameHe || line.fromStageNameEn;
  return line.fromStageNameEn;
}

function outputName(line: WipIncomingLine, locale: string): string {
  if (locale.startsWith('ar')) {
    return line.outputNameAr || line.outputNameEn || stageName(line, locale);
  }
  if (locale.startsWith('he')) {
    return line.outputNameHe || line.outputNameEn || stageName(line, locale);
  }
  return line.outputNameEn || stageName(line, locale);
}

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

function lanesFromBoard(
  lanes: WipIncomingLane[] | undefined,
  lines: WipIncomingLine[],
): WipIncomingLane[] {
  if (lanes && lanes.length > 0) return lanes;
  const map = new Map<string, WipIncomingLane>();
  for (const line of lines) {
    const key = line.fromStageCode || 'UNKNOWN';
    let lane = map.get(key);
    if (!lane) {
      lane = {
        fromStageCode: key,
        fromStageNameEn: line.fromStageNameEn,
        fromStageNameAr: line.fromStageNameAr,
        fromStageNameHe: line.fromStageNameHe,
        lines: [],
        statusKey: 'WAITING_PRODUCTION',
        expected: 0,
        received: 0,
        produced: 0,
      };
      map.set(key, lane);
    }
    lane.lines.push(line);
    lane.expected += line.expected;
    lane.received += line.received;
    lane.produced += line.produced;
  }
  for (const lane of map.values()) {
    if (lane.received >= lane.expected && lane.expected > 0) lane.statusKey = 'RECEIVED';
    else if (lane.received > 0) lane.statusKey = 'PARTIALLY_RECEIVED';
    else if (lane.produced > 0) lane.statusKey = 'READY_TO_COLLECT';
    else lane.statusKey = 'WAITING_PRODUCTION';
  }
  return [...map.values()];
}

/**
 * Incoming SEMI pieces — receive via confirm checklist or optional QR fast path.
 */
export const TaskIncomingWorkFloorSection = forwardRef<TaskIncomingFloorHandle, Props>(
  function TaskIncomingWorkFloorSection(
    {
      taskId,
      enabled = true,
      embedded = false,
      showNoneWhenEmpty = false,
      onReceived,
      onAvailabilityChange,
    },
    ref,
  ) {
    const { t, locale, isRTL } = useLocale();
    const { colors, theme, colorScheme } = useTheme();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [lines, setLines] = useState<WipIncomingLine[]>([]);
    const [lanes, setLanes] = useState<WipIncomingLane[]>([]);
    const [whereHints, setWhereHints] = useState<WipWhereHint[]>([]);
    const [required, setRequired] = useState(false);
    const [allReceived, setAllReceived] = useState(true);
    const [thumbs, setThumbs] = useState<Record<string, string>>({});
    const [receiveOpen, setReceiveOpen] = useState(false);
    const [discrepancyOpen, setDiscrepancyOpen] = useState(false);
    const [eligible, setEligible] = useState<WipEligibleKit[]>([]);
    const [activeLine, setActiveLine] = useState<WipIncomingLine | null>(null);
    const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
    const [scanCode, setScanCode] = useState('');
    const [qtyText, setQtyText] = useState('1');
    const [scanConfirm, setScanConfirm] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [discCategory, setDiscCategory] =
      useState<WipDiscrepancyCategory>('MISSING_COMPONENT');
    const [discNotes, setDiscNotes] = useState('');

    const reload = useCallback(async () => {
      if (!enabled) return;
      setLoading(true);
      try {
        const data = await getTaskWipIncoming(taskId);
        const nextRequired = Boolean(data.required);
        const nextLines = data.lines ?? [];
        const nextAll = Boolean(data.allReceived);
        setRequired(nextRequired);
        setLines(nextLines);
        setAllReceived(nextAll);
        setLanes(lanesFromBoard(data.lanes, nextLines));
        setWhereHints(data.whereHints ?? []);
        onAvailabilityChange?.({
          required: nextRequired,
          allReceived: nextAll,
          lines: nextLines,
        });
      } catch {
        showToast({ variant: 'error', message: t('mobile.tasks.incomingLoadFailed') });
      } finally {
        setLoading(false);
      }
    }, [enabled, taskId, showToast, t, onAvailabilityChange]);

    useEffect(() => {
      void reload();
    }, [reload]);

    useEffect(() => {
      let cancelled = false;
      const ids = lines
        .map((l) => l.thumbDocumentId)
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) {
        setThumbs({});
        return;
      }
      void (async () => {
        const next: Record<string, string> = {};
        for (const id of ids) {
          try {
            next[id] = await resolveDocumentUrl(id);
          } catch {
            /* skip */
          }
        }
        if (!cancelled) setThumbs(next);
      })();
      return () => {
        cancelled = true;
      };
    }, [lines]);

    const firstReceivable = useMemo(
      () =>
        lines.find(
          (l) =>
            l.statusKey === 'READY_TO_COLLECT' || l.statusKey === 'PARTIALLY_RECEIVED',
        ) ?? null,
      [lines],
    );

    const openReceiveForLine = useCallback(
      async (line: WipIncomingLine) => {
        setActiveLine(line);
        setSelectedKitId(line.kitId);
        setScanCode('');
        setScanConfirm(null);
        const def =
          line.available > 0 ? line.available : Math.max(1, line.outstanding || 1);
        setQtyText(String(def));
        setBusy(true);
        try {
          const data = await getTaskWipEligible(taskId);
          setEligible(data.kits ?? []);
        } catch {
          setEligible([]);
        } finally {
          setBusy(false);
          setReceiveOpen(true);
        }
      },
      [taskId],
    );

    useImperativeHandle(
      ref,
      () => ({
        openReceive: () => {
          if (firstReceivable) void openReceiveForLine(firstReceivable);
          else {
            showToast({
              variant: 'warning',
              message: t('mobile.tasks.incomingNoEligible'),
            });
          }
        },
        getAvailability: () => ({ required, allReceived, lines }),
      }),
      [firstReceivable, openReceiveForLine, required, allReceived, lines, showToast, t],
    );

    function locationFor(line: WipIncomingLine): string | null {
      const byKit = whereHints.find(
        (h) => h.kitId && line.kitId && h.kitId === line.kitId && h.locationName,
      );
      if (byKit?.locationName) return byKit.locationName;
      const byStage = whereHints.find(
        (h) => h.fromStageCode === line.fromStageCode && h.locationName,
      );
      return byStage?.locationName ?? null;
    }

    function bumpQty(delta: number) {
      const cur = Number(qtyText) || 0;
      const max = activeLine?.available ?? cur + delta;
      const next = Math.max(1, Math.min(max > 0 ? max : cur + delta, cur + delta));
      setQtyText(String(next));
    }

    async function submitReceive(opts: { scanCode?: string; kitId?: string }) {
      const qty = Number(qtyText);
      if (!(qty > 0)) {
        showToast({ variant: 'error', message: t('mobile.tasks.incomingQtyRequired') });
        return;
      }
      setBusy(true);
      try {
        await receiveTaskWip(taskId, {
          scanCode: opts.scanCode,
          kitId: opts.kitId,
          quantity: qty,
        });
        void haptics.confirmMedium();
        showToast({ variant: 'success', message: t('mobile.tasks.incomingReceivedToast') });
        setReceiveOpen(false);
        setScanCode('');
        setScanConfirm(null);
        await reload();
        onReceived?.();
      } catch (err) {
        void haptics.error();
        const code =
          err instanceof ApiError
            ? err.code
            : err && typeof err === 'object' && 'code' in err
              ? String((err as { code?: string }).code)
              : '';
        let message =
          err instanceof ApiError && err.message.trim()
            ? err.message
            : t('mobile.tasks.incomingReceiveFailed');
        if (code === 'WIP_ORDER_MISMATCH') message = t('mobile.tasks.incomingQrWrongOrder');
        else if (code === 'WIP_WRONG_NEXT_STAGE') message = t('mobile.tasks.incomingQrWrongStage');
        else if (code === 'WIP_NOTHING_TO_RECEIVE' || code === 'WIP_OVER_RECEIVE') {
          message = t('mobile.tasks.incomingQrAlreadyReceived');
        } else if (code === 'WIP_SCAN_IS_RAW') message = t('mobile.tasks.incomingQrIsRaw');
        else if (code === 'WIP_SCAN_NOT_FOUND' || code === 'WIP_KIT_UNAVAILABLE') {
          message = t('mobile.tasks.incomingQrUnknown');
        }
        showToast({ variant: 'error', message });
      } finally {
        setBusy(false);
      }
    }

    async function submitDiscrepancy() {
      setBusy(true);
      try {
        await reportTaskWipDiscrepancy(taskId, {
          category: discCategory,
          notes: discNotes.trim() || undefined,
          kitId: activeLine?.kitId ?? selectedKitId ?? undefined,
          predecessorStageCode: activeLine?.fromStageCode,
          idempotencyKey: `wip-disc-${createRequestId()}`,
        });
        void haptics.confirmMedium();
        showToast({
          variant: 'success',
          message: t('mobile.tasks.discrepancyReported'),
        });
        setDiscrepancyOpen(false);
        setDiscNotes('');
      } catch (err) {
        void haptics.error();
        showToast({
          variant: 'error',
          message:
            err instanceof ApiError && err.message.trim()
              ? err.message
              : t('mobile.tasks.discrepancyFailed'),
        });
      } finally {
        setBusy(false);
      }
    }

    if (!enabled) return null;
    if (!loading && !required && lines.length === 0 && !showNoneWhenEmpty) return null;

    const stampTitle = t('mobile.tasks.semiInputTitle');

    const body = (
      <View style={{ gap: theme.spacing.sm }}>
        {loading && lines.length === 0 ? (
          <ActivityIndicator color={colors.brand} />
        ) : null}

        {!loading && !required && lines.length === 0 ? (
          <AppText
            variant="body"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.tasks.semiInputNone')}
          </AppText>
        ) : null}

        {lanes.map((lane) => {
          const laneTitle = t('mobile.tasks.incomingLaneFrom', {
            stage: stageName(lane, locale),
          });
          return (
            <View key={lane.fromStageCode} style={{ gap: theme.spacing.sm }}>
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
                  weight="semibold"
                  style={{
                    color: colors.brand,
                    letterSpacing: locale === 'ar' ? 0 : 0.5,
                    textTransform: locale === 'ar' ? 'none' : 'uppercase',
                    fontSize: 11,
                    flex: 1,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {laneTitle}
                </AppText>
                <AppText variant="caption" weight="medium" dir="ltr" color="secondary">
                  {t('mobile.tasks.incomingOfExpected', {
                    received: formatQty(lane.received),
                    expected: formatQty(lane.expected),
                  })}
                </AppText>
              </View>

              {lane.lines.map((line) => {
                const canReceive =
                  line.statusKey === 'READY_TO_COLLECT' ||
                  line.statusKey === 'PARTIALLY_RECEIVED';
                const thumb = line.thumbDocumentId ? thumbs[line.thumbDocumentId] : null;
                const loc = locationFor(line);
                const partial = line.statusKey === 'PARTIALLY_RECEIVED';

                return (
                  <View
                    key={`${line.kitId ?? line.predecessorSnapshotNodeId}-${line.fromStageCode}`}
                    style={{
                      gap: theme.spacing.xs,
                      padding: theme.spacing.md,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: partial ? colors.warning : colors.border,
                      backgroundColor: colors.surfaceSecondary,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        gap: theme.spacing.sm,
                        alignItems: 'flex-start',
                      }}
                    >
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: theme.radius.md,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                          overflow: 'hidden',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={{ width: 56, height: 56 }} />
                        ) : (
                          <Ionicons name="cube-outline" size={22} color={colors.textMuted} />
                        )}
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <AppText variant="body" weight="semibold">
                          {outputName(line, locale)}
                        </AppText>
                        <AppText variant="bodySecondary" dir="ltr">
                          {t('mobile.tasks.incomingOfExpected', {
                            received: formatQty(line.received),
                            expected: formatQty(line.expected),
                          })}
                        </AppText>
                        {loc ? (
                          <AppText variant="caption" color="muted">
                            {t('mobile.tasks.incomingWhereHint', { place: loc })}
                          </AppText>
                        ) : null}
                        <View
                          style={{
                            alignSelf: isRTL ? 'flex-end' : 'flex-start',
                            marginTop: 2,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: theme.radius.full,
                            backgroundColor:
                              line.statusKey === 'RECEIVED'
                                ? colors.successSoft
                                : partial
                                  ? colors.warningSoft
                                  : line.statusKey === 'WAITING_PRODUCTION'
                                    ? colors.surface
                                    : colors.brandSoft,
                          }}
                        >
                          <AppText
                            variant="caption"
                            weight="medium"
                            style={{
                              color:
                                line.statusKey === 'RECEIVED'
                                  ? colors.success
                                  : partial
                                    ? colors.warning
                                    : line.statusKey === 'WAITING_PRODUCTION'
                                      ? colors.textMuted
                                      : colors.brand,
                            }}
                          >
                            {t(statusLabelKey(line.statusKey))}
                          </AppText>
                        </View>
                      </View>
                    </View>

                    {canReceive ? (
                      <View
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          flexWrap: 'wrap',
                          gap: theme.spacing.sm,
                          marginTop: theme.spacing.xs,
                        }}
                      >
                        <AnimatedPressable
                          onPress={() => void openReceiveForLine(line)}
                          style={{
                            paddingHorizontal: theme.spacing.md,
                            paddingVertical: theme.spacing.sm,
                            borderRadius: theme.radius.md,
                            backgroundColor: colors.brand,
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Ionicons name="download-outline" size={16} color={colors.onBrand} />
                          <AppText
                            variant="bodySecondary"
                            weight="semibold"
                            style={{ color: colors.onBrand }}
                          >
                            {t('mobile.tasks.incomingReceivePieces')}
                          </AppText>
                        </AnimatedPressable>
                        <Pressable
                          onPress={() => {
                            setActiveLine(line);
                            setDiscrepancyOpen(true);
                          }}
                          style={{
                            paddingHorizontal: theme.spacing.md,
                            paddingVertical: theme.spacing.sm,
                            borderRadius: theme.radius.md,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <AppText variant="bodySecondary" weight="medium">
                            {t('mobile.tasks.discrepancyReport')}
                          </AppText>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        })}

        <BottomSheet
          open={receiveOpen}
          onClose={() => setReceiveOpen(false)}
          title={
            activeLine
              ? t('mobile.tasks.incomingReceiveFrom', {
                  stage: stageName(activeLine, locale),
                })
              : t('mobile.tasks.incomingReceiveTitle')
          }
          sheetHeight={560}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              gap: theme.spacing.md,
              paddingBottom: theme.spacing.lg,
            }}
          >
            <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('mobile.tasks.incomingReceiveSoftHint')}
            </AppText>

            {activeLine ? (
              <View
                style={{
                  gap: theme.spacing.xs,
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{
                    color: colors.brand,
                    textTransform: locale === 'ar' ? 'none' : 'uppercase',
                    fontSize: 11,
                  }}
                >
                  {t('mobile.tasks.incomingExpectedChecklist')}
                </AppText>
                <AppText variant="body" weight="semibold">
                  {outputName(activeLine, locale)}
                </AppText>
                <AppText variant="bodySecondary" dir="ltr">
                  {t('mobile.tasks.incomingOfExpected', {
                    received: formatQty(activeLine.received),
                    expected: formatQty(activeLine.expected),
                  })}
                </AppText>
                <AppText variant="caption" color="muted">
                  {t('mobile.tasks.incomingProducedAvailable', {
                    produced: formatQty(activeLine.produced),
                    available: formatQty(activeLine.available),
                    received: formatQty(activeLine.received),
                  })}
                </AppText>
                {locationFor(activeLine) ? (
                  <AppText variant="caption" color="muted">
                    {t('mobile.tasks.incomingWhereHint', {
                      place: locationFor(activeLine)!,
                    })}
                  </AppText>
                ) : null}
              </View>
            ) : null}

            <View style={{ gap: theme.spacing.xs }}>
              <AppText
                variant="caption"
                weight="semibold"
                style={{
                  color: colors.brand,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  fontSize: 11,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {t('mobile.tasks.incomingConfirmExpectedKit')}
              </AppText>
              {eligible.length === 0 ? (
                <AppText variant="body" color="muted">
                  {busy
                    ? t('mobile.tasks.scanning')
                    : t('mobile.tasks.incomingNoEligible')}
                </AppText>
              ) : (
                eligible.map((kit) => {
                  const active = selectedKitId === kit.kitId;
                  return (
                    <Pressable
                      key={kit.kitId}
                      onPress={() => {
                        void haptics.selection();
                        setSelectedKitId(kit.kitId);
                        setScanCode(kit.qrCode ?? '');
                        setQtyText(String(kit.available > 0 ? kit.available : 1));
                      }}
                      style={{
                        padding: theme.spacing.md,
                        borderRadius: theme.radius.md,
                        borderWidth: 1,
                        borderColor: active ? colors.brand : colors.border,
                        backgroundColor: active ? colors.brandSoft : colors.surface,
                        gap: 4,
                      }}
                    >
                      <AppText variant="body" weight="semibold">
                        {stageName(kit, locale)}
                      </AppText>
                      <AppText variant="bodySecondary">
                        {t('mobile.tasks.incomingAvailableQty', {
                          qty: formatQty(kit.available),
                        })}
                      </AppText>
                    </Pressable>
                  );
                })
              )}
            </View>

            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="caption" color="muted">
                {t('mobile.tasks.incomingQtyLabel')}
              </AppText>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <Pressable
                  onPress={() => bumpQty(-1)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="remove" size={18} color={colors.brand} />
                </Pressable>
                <TextInput
                  value={qtyText}
                  onChangeText={setQtyText}
                  keyboardType="decimal-pad"
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    color: colors.textPrimary,
                    textAlign: 'center',
                  }}
                />
                <Pressable
                  onPress={() => bumpQty(1)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="add" size={18} color={colors.brand} />
                </Pressable>
              </View>
            </View>

            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('mobile.tasks.incomingScanFastPath')}
              </AppText>
              <CodeField
                label={t('mobile.tasks.incomingScanOptional')}
                value={scanCode}
                onChangeText={(v) => {
                  setScanCode(v);
                  setScanConfirm(null);
                }}
                onScanned={(code) => {
                  setScanCode(code);
                  setScanConfirm(t('mobile.tasks.incomingQrIdentified'));
                  void haptics.selection();
                }}
                autoCapitalize="characters"
                placeholder="WIP-PO-…"
                scanTitle={t('mobile.tasks.incomingReceiveTitle')}
                scanHint={t('mobile.tasks.incomingReceiveSoftHint')}
              />
              {scanConfirm ? (
                <AppText variant="bodySecondary" style={{ color: colors.success }}>
                  {scanConfirm}
                </AppText>
              ) : null}
            </View>

            <PrimaryButton
              label={t('mobile.tasks.incomingConfirmReceive')}
              onPress={() =>
                void submitReceive({
                  scanCode: scanCode.trim() || undefined,
                  kitId: selectedKitId ?? activeLine?.kitId ?? undefined,
                })
              }
              loading={busy}
              style={{ minHeight: theme.sizes.touch.min }}
            />
            <SecondaryButton
              label={t('mobile.tasks.discrepancyReport')}
              onPress={() => setDiscrepancyOpen(true)}
            />
            <SecondaryButton
              label={t('mobile.tasks.cancel')}
              onPress={() => setReceiveOpen(false)}
            />
          </ScrollView>
        </BottomSheet>

        <BottomSheet
          open={discrepancyOpen}
          onClose={() => setDiscrepancyOpen(false)}
          title={t('mobile.tasks.discrepancyReport')}
          sheetHeight={440}
        >
          <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
            <AppText variant="caption" color="muted">
              {t('mobile.tasks.discrepancyHint')}
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
              }}
            >
              {DISCREPANCY_CATEGORIES.map((cat) => {
                const active = discCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      void haptics.selection();
                      setDiscCategory(cat);
                    }}
                    style={{
                      paddingHorizontal: theme.spacing.lg,
                      paddingVertical: theme.spacing.md,
                      minHeight: theme.sizes.touch.min,
                      borderRadius: theme.radius.md,
                      backgroundColor: active ? colors.brand : colors.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.border,
                      justifyContent: 'center',
                    }}
                  >
                    <AppText
                      variant="label"
                      weight={active ? 'semibold' : 'medium'}
                      style={{ color: active ? colors.onBrand : colors.textPrimary }}
                    >
                      {t(`mobile.tasks.discrepancy.${cat}`)}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
            <TextField
              label={t('mobile.tasks.discrepancyNotes')}
              value={discNotes}
              onChangeText={setDiscNotes}
              multiline
              numberOfLines={3}
              placeholder={t('mobile.tasks.discrepancyNotesPlaceholder')}
            />
            <PrimaryButton
              label={t('mobile.tasks.discrepancySubmit')}
              onPress={() => void submitDiscrepancy()}
              loading={busy}
              style={{ minHeight: theme.sizes.touch.min }}
            />
            <SecondaryButton
              label={t('mobile.tasks.cancel')}
              onPress={() => setDiscrepancyOpen(false)}
            />
          </View>
        </BottomSheet>
      </View>
    );

    if (embedded) {
      return (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              color: colors.textSecondary,
              letterSpacing: locale === 'ar' ? 0 : 0.5,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              fontSize: 11,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {stampTitle}
          </AppText>
          <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.tasks.incomingReceiveSoftHint')}
          </AppText>
          {body}
        </View>
      );
    }

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
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
            gap: 2,
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              color: colors.brand,
              letterSpacing: locale === 'ar' ? 0 : 0.6,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              fontSize: 11,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {stampTitle}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
          >
            {t('mobile.tasks.semiInputCaption')}
          </AppText>
        </View>
        <View style={{ padding: theme.spacing.md }}>{body}</View>
      </View>
    );
  },
);
