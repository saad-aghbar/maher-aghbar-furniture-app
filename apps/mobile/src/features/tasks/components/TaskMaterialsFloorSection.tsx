import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { useCodeScanner } from '@/components/scan/CodeScannerProvider';
import { useToast } from '@/components/feedback/Toast';
import { listWarehouses } from '@/features/inventory/api';
import { InventorySkuThumb } from '@/features/inventory/components/InventorySkuThumb';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  identifyTaskMaterial,
  listTaskMaterialUsage,
  saveTaskMaterialUsage,
  type TaskMaterialUsageLine,
  type TaskMaterialUsageWarehouse,
} from '../api';

type DraftWarehouse = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  availableQty?: number;
  isDefault?: boolean;
};

type DraftLine = {
  inventoryItemId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  imageUrl?: string | null;
  unit: string;
  expectedQty: number;
  actualQty: number;
  /** Editable qty string so the worker can type freely. */
  qtyText: string;
  returnedQty: number;
  scrapQty: number;
  reasonNotes: string;
  isExtra: boolean;
  selected: boolean;
  issueWarehouseId: string | null;
  returnWarehouseId: string | null;
  warehouses: DraftWarehouse[];
  returnOpen: boolean;
  scrapOpen: boolean;
};

export type TaskMaterialsFloorHandle = {
  /** True when at least one material is selected with qty &gt; 0. */
  hasSelection: () => boolean;
  /** Persist current draft (selected + deselected zeros). */
  commit: () => Promise<void>;
};

type Props = {
  taskId: string;
  enabled?: boolean;
};

function pickDefaultWarehouseId(warehouses: DraftWarehouse[]): string | null {
  const def = warehouses.find((w) => w.isDefault);
  return def?.id ?? warehouses[0]?.id ?? null;
}

function toDraft(row: TaskMaterialUsageLine): DraftLine {
  const item = row.inventoryItem;
  const expectedQty = Number(row.expectedQty) || 0;
  const actualRaw = row.actualQty != null ? Number(row.actualQty) : 0;
  const selected = actualRaw > 0;
  const actualQty = selected ? actualRaw : expectedQty > 0 ? expectedQty : 1;
  const warehouses: DraftWarehouse[] = (row.warehouses ?? []).map((w) => ({
    id: w.id,
    code: w.code,
    nameEn: w.nameEn,
    nameAr: w.nameAr,
    nameHe: w.nameHe,
    availableQty: w.availableQty,
    isDefault: w.isDefault,
  }));
  const returnedQty = Number(row.returnedQty) || 0;
  const scrapQty = Number(row.scrapQty) || 0;
  return {
    inventoryItemId: row.inventoryItemId,
    sku: row.sku,
    nameEn: item?.nameEn ?? row.sku,
    nameAr: item?.nameAr ?? row.sku,
    nameHe: item?.nameHe,
    imageUrl: item?.imageUrl,
    unit: item?.unit ?? 'pcs',
    expectedQty,
    actualQty,
    qtyText: String(actualQty),
    returnedQty,
    scrapQty,
    reasonNotes: row.reasonNotes ?? '',
    isExtra: Boolean(row.isExtra),
    selected,
    issueWarehouseId: row.issueWarehouseId ?? null,
    returnWarehouseId: row.returnWarehouseId ?? null,
    warehouses,
    returnOpen: returnedQty > 0,
    scrapOpen: scrapQty > 0,
  };
}

function stepQty(unit: string): number {
  const u = unit.toLowerCase();
  if (u.includes('m') || u.includes('kg') || u.includes('l')) return 0.1;
  return 1;
}

function roundQty(n: number, step: number): number {
  const prec = step < 1 ? 1 : 0;
  const f = 10 ** prec;
  return Math.round(n * f) / f;
}

function maxReturnQty(line: Pick<DraftLine, 'expectedQty' | 'actualQty' | 'unit'>): number {
  return Math.max(0, roundQty(line.expectedQty - line.actualQty, stepQty(line.unit)));
}

function needsIssueWarehouse(line: DraftLine): boolean {
  return (
    line.selected &&
    line.actualQty > 0 &&
    (line.isExtra || line.actualQty > line.expectedQty)
  );
}

function warehousesFromApi(
  rows: TaskMaterialUsageWarehouse[] | DraftWarehouse[],
): DraftWarehouse[] {
  return rows.map((w) => ({
    id: w.id,
    code: w.code,
    nameEn: w.nameEn,
    nameAr: w.nameAr,
    nameHe: w.nameHe,
    availableQty: 'availableQty' in w ? w.availableQty : undefined,
    isDefault: w.isDefault,
  }));
}

/**
 * Inline raw materials on Task details — full BOM strips, select + qty + notes.
 */
export const TaskMaterialsFloorSection = forwardRef<TaskMaterialsFloorHandle, Props>(
  function TaskMaterialsFloorSection({ taskId, enabled = true }, ref) {
    const { user } = useAuth();
    const { t, locale, isRTL } = useLocale();
    const { colors, theme, colorScheme } = useTheme();
    const { showToast } = useToast();
    const { openScanner } = useCodeScanner();
    const allowed = enabled && can(user, 'production.material-usage.record');
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [lines, setLines] = useState<DraftLine[]>([]);
    const [scanMessage, setScanMessage] = useState<string | null>(null);
    const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

    const reload = useCallback(() => {
      if (!allowed) return;
      setLoading(true);
      void listTaskMaterialUsage(taskId)
        .then((rows) =>
          setLines(
            rows
              .filter(
                (r) =>
                  !r.inventoryItem?.itemClass ||
                  r.inventoryItem.itemClass === 'RAW_MATERIAL',
              )
              .map(toDraft),
          ),
        )
        .catch(() => {
          showToast({ variant: 'error', message: t('mobile.tasks.materialsLoadFailed') });
        })
        .finally(() => setLoading(false));
    }, [allowed, taskId, showToast, t]);

    useEffect(() => {
      reload();
    }, [reload]);

    const assertWarehouseSelection = useCallback(
      (draft: DraftLine[]) => {
        for (const line of draft) {
          if (needsIssueWarehouse(line) && !line.issueWarehouseId) {
            showToast({
              variant: 'error',
              message: t('mobile.tasks.issueWarehouseRequired'),
            });
            throw new Error('WAREHOUSE_REQUIRED');
          }
          if (line.returnedQty > 0 && !line.returnWarehouseId) {
            showToast({
              variant: 'error',
              message: t('mobile.tasks.returnWarehouseRequired'),
            });
            throw new Error('WAREHOUSE_REQUIRED');
          }
        }
      },
      [showToast, t],
    );

    useImperativeHandle(
      ref,
      () => ({
        // Empty BOM: nothing to choose — don't block Finish.
        hasSelection: () =>
          lines.length === 0 || lines.some((l) => l.selected && l.actualQty > 0),
        commit: async () => {
          if (lines.length === 0) return;
          assertWarehouseSelection(lines);
          await saveTaskMaterialUsage(
            taskId,
            lines.map((line) => ({
              inventoryItemId: line.inventoryItemId,
              actualQty: line.selected ? line.actualQty : 0,
              returnedQty: line.selected ? line.returnedQty : 0,
              scrapQty: line.selected ? line.scrapQty : 0,
              reasonNotes: line.reasonNotes.trim() || null,
              isExtra: line.isExtra,
              sku: line.sku,
              issueWarehouseId: line.selected ? line.issueWarehouseId : null,
              returnWarehouseId: line.selected ? line.returnWarehouseId : null,
            })),
          );
        },
      }),
      [assertWarehouseSelection, lines, taskId],
    );

    function toggleSelect(inventoryItemId: string) {
      void haptics.selection();
      setLines((prev) =>
        prev.map((line) => {
          if (line.inventoryItemId !== inventoryItemId) return line;
          if (line.selected) {
            return {
              ...line,
              selected: false,
              returnedQty: 0,
              scrapQty: 0,
              returnOpen: false,
              scrapOpen: false,
              issueWarehouseId: null,
              returnWarehouseId: null,
            };
          }
          const nextQty =
            line.actualQty > 0
              ? line.actualQty
              : line.expectedQty > 0
                ? line.expectedQty
                : 1;
          const needsIssue = line.isExtra || nextQty > line.expectedQty;
          return {
            ...line,
            selected: true,
            actualQty: nextQty,
            qtyText: String(nextQty),
            issueWarehouseId: needsIssue
              ? line.issueWarehouseId ?? pickDefaultWarehouseId(line.warehouses)
              : line.issueWarehouseId,
          };
        }),
      );
    }

    function bumpQty(inventoryItemId: string, dir: 1 | -1) {
      void haptics.selection();
      setLines((prev) =>
        prev.map((line) => {
          if (line.inventoryItemId !== inventoryItemId) return line;
          const step = stepQty(line.unit);
          const next = Math.max(0, roundQty(line.actualQty + dir * step, step));
          const cap = Math.max(0, roundQty(line.expectedQty - next, step));
          const returnedQty = Math.min(line.returnedQty, cap);
          const needsIssue = line.isExtra || next > line.expectedQty;
          return {
            ...line,
            selected: next > 0 ? true : line.selected,
            actualQty: next,
            qtyText: String(next),
            returnedQty,
            returnOpen: returnedQty > 0 ? line.returnOpen : false,
            issueWarehouseId: needsIssue
              ? line.issueWarehouseId ?? pickDefaultWarehouseId(line.warehouses)
              : line.issueWarehouseId,
          };
        }),
      );
    }

    function setQtyText(inventoryItemId: string, text: string) {
      const cleaned = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
      const parts = cleaned.split('.');
      const normalized =
        parts.length <= 2
          ? cleaned
          : `${parts[0]}.${parts.slice(1).join('')}`;
      const parsed = parseFloat(normalized);
      const actualQty = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      setLines((prev) =>
        prev.map((line) => {
          if (line.inventoryItemId !== inventoryItemId) return line;
          const step = stepQty(line.unit);
          const cap = Math.max(0, roundQty(line.expectedQty - actualQty, step));
          const returnedQty = Math.min(line.returnedQty, cap);
          const needsIssue = line.isExtra || actualQty > line.expectedQty;
          return {
            ...line,
            selected: true,
            qtyText: normalized,
            actualQty,
            returnedQty,
            issueWarehouseId: needsIssue
              ? line.issueWarehouseId ?? pickDefaultWarehouseId(line.warehouses)
              : line.issueWarehouseId,
          };
        }),
      );
    }

    function blurQty(inventoryItemId: string) {
      setLines((prev) =>
        prev.map((line) => {
          if (line.inventoryItemId !== inventoryItemId) return line;
          const next = line.actualQty > 0 ? line.actualQty : 0;
          return { ...line, actualQty: next, qtyText: String(next) };
        }),
      );
    }

    function bumpReturned(inventoryItemId: string, dir: 1 | -1) {
      void haptics.selection();
      setLines((prev) =>
        prev.map((line) => {
          if (line.inventoryItemId !== inventoryItemId) return line;
          const step = stepQty(line.unit);
          const cap = maxReturnQty(line);
          const next = Math.max(0, Math.min(cap, roundQty(line.returnedQty + dir * step, step)));
          return {
            ...line,
            returnedQty: next,
            returnOpen: true,
            returnWarehouseId:
              next > 0
                ? line.returnWarehouseId ?? pickDefaultWarehouseId(line.warehouses)
                : null,
          };
        }),
      );
    }

    function bumpScrap(inventoryItemId: string, dir: 1 | -1) {
      void haptics.selection();
      setLines((prev) =>
        prev.map((line) => {
          if (line.inventoryItemId !== inventoryItemId) return line;
          const step = stepQty(line.unit);
          const next = Math.max(0, roundQty(line.scrapQty + dir * step, step));
          return {
            ...line,
            scrapQty: next,
            scrapOpen: true,
          };
        }),
      );
    }

    function setNotes(inventoryItemId: string, reasonNotes: string) {
      setLines((prev) =>
        prev.map((line) =>
          line.inventoryItemId === inventoryItemId ? { ...line, reasonNotes } : line,
        ),
      );
    }

    function setIssueWarehouse(inventoryItemId: string, issueWarehouseId: string) {
      void haptics.selection();
      setLines((prev) =>
        prev.map((line) =>
          line.inventoryItemId === inventoryItemId ? { ...line, issueWarehouseId } : line,
        ),
      );
    }

    function setReturnWarehouse(inventoryItemId: string, returnWarehouseId: string) {
      void haptics.selection();
      setLines((prev) =>
        prev.map((line) =>
          line.inventoryItemId === inventoryItemId ? { ...line, returnWarehouseId } : line,
        ),
      );
    }

    function toggleReturnOpen(inventoryItemId: string) {
      void haptics.selection();
      setLines((prev) =>
        prev.map((line) => {
          if (line.inventoryItemId !== inventoryItemId) return line;
          if (line.returnOpen) {
            return {
              ...line,
              returnOpen: false,
              returnedQty: 0,
              returnWarehouseId: null,
            };
          }
          const cap = maxReturnQty(line);
          const seed = cap > 0 ? cap : 0;
          return {
            ...line,
            returnOpen: true,
            returnedQty: line.returnedQty > 0 ? line.returnedQty : seed,
            returnWarehouseId:
              line.returnWarehouseId ?? pickDefaultWarehouseId(line.warehouses),
          };
        }),
      );
    }

    function toggleScrapOpen(inventoryItemId: string) {
      void haptics.selection();
      setLines((prev) =>
        prev.map((line) => {
          if (line.inventoryItemId !== inventoryItemId) return line;
          if (line.scrapOpen) {
            return { ...line, scrapOpen: false, scrapQty: 0 };
          }
          return {
            ...line,
            scrapOpen: true,
            scrapQty: line.scrapQty > 0 ? line.scrapQty : stepQty(line.unit),
          };
        }),
      );
    }

    async function loadRawWarehousesFallback(): Promise<DraftWarehouse[]> {
      try {
        const all = await listWarehouses();
        return all
          .filter(
            (w) =>
              w.isActive !== false &&
              (w.type === 'RAW_MATERIALS' || w.type === 'RAW' || !w.type),
          )
          .map((w) => ({
            id: w.id,
            code: w.code,
            nameEn: w.nameEn,
            nameAr: w.nameAr,
            isDefault: w.isDefault,
          }));
      } catch {
        return [];
      }
    }

    async function onScan() {
      setScanMessage(null);
      setScanning(true);
      try {
        const code = await openScanner({
          title: t('mobile.tasks.scanMaterialTitle'),
          hint: t('mobile.tasks.scanMaterialHint'),
        });
        if (!code?.trim()) return;
        const result = await identifyTaskMaterial(taskId, code.trim());
        if (result.status === 'MATCH') {
          void haptics.confirmLight();
          setLines((prev) =>
            prev.map((line) => {
              if (line.inventoryItemId !== result.inventoryItemId) return line;
              const nextQty =
                line.actualQty > 0
                  ? line.actualQty
                  : result.expectedQty > 0
                    ? result.expectedQty
                    : 1;
              const needsIssue = line.isExtra || nextQty > line.expectedQty;
              return {
                ...line,
                selected: true,
                actualQty: nextQty,
                qtyText: String(nextQty),
                issueWarehouseId: needsIssue
                  ? line.issueWarehouseId ?? pickDefaultWarehouseId(line.warehouses)
                  : line.issueWarehouseId,
              };
            }),
          );
          setScanMessage(t('mobile.tasks.scanMaterialMatch', { sku: result.sku }));
        } else if (result.status === 'EXTRA') {
          void haptics.selection();
          const fallbackWh = await loadRawWarehousesFallback();
          setLines((prev) => {
            if (prev.some((l) => l.inventoryItemId === result.inventoryItemId)) {
              return prev.map((l) => {
                if (l.inventoryItemId !== result.inventoryItemId) return l;
                const nextQty = l.actualQty > 0 ? l.actualQty : 1;
                const warehouses =
                  l.warehouses.length > 0 ? l.warehouses : warehousesFromApi(fallbackWh);
                return {
                  ...l,
                  selected: true,
                  actualQty: nextQty,
                  qtyText: String(nextQty),
                  isExtra: true,
                  warehouses,
                  issueWarehouseId:
                    l.issueWarehouseId ?? pickDefaultWarehouseId(warehouses),
                };
              });
            }
            const warehouses = warehousesFromApi(fallbackWh);
            return [
              ...prev,
              {
                inventoryItemId: result.inventoryItemId,
                sku: result.sku,
                nameEn: result.nameEn,
                nameAr: result.nameAr,
                nameHe: result.nameHe,
                imageUrl: result.imageUrl,
                unit: result.unit,
                expectedQty: 0,
                actualQty: 1,
                qtyText: '1',
                returnedQty: 0,
                scrapQty: 0,
                reasonNotes: '',
                isExtra: true,
                selected: true,
                issueWarehouseId: pickDefaultWarehouseId(warehouses),
                returnWarehouseId: null,
                warehouses,
                returnOpen: false,
                scrapOpen: false,
              },
            ];
          });
          setScanMessage(t('mobile.tasks.scanMaterialExtra', { sku: result.sku }));
        } else if (result.status === 'WRONG') {
          void haptics.error();
          setScanMessage(
            t('mobile.tasks.scanMaterialWrong', {
              sku: result.scannedSku,
              expected: result.expectedSkus.join(', '),
            }),
          );
        } else {
          void haptics.error();
          setScanMessage(t('mobile.tasks.scanMaterialNotFound', { code: result.code }));
        }
      } catch {
        void haptics.error();
        setScanMessage(t('mobile.tasks.scanMaterialFailed'));
      } finally {
        setScanning(false);
      }
    }

    function renderWarehousePicker(
      line: DraftLine,
      mode: 'issue' | 'return',
    ) {
      const selectedId =
        mode === 'issue' ? line.issueWarehouseId : line.returnWarehouseId;
      const onPick = mode === 'issue' ? setIssueWarehouse : setReturnWarehouse;
      const label =
        mode === 'issue'
          ? t('mobile.tasks.materialTakeFromWarehouse')
          : t('mobile.tasks.materialReturnToWarehouse');

      if (line.warehouses.length === 0) {
        return (
          <AppText variant="caption" color="muted">
            {label}
          </AppText>
        );
      }

      return (
        <View style={{ gap: 6 }}>
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {label}
          </AppText>
          <View style={{ gap: 4 }}>
            {line.warehouses.map((wh) => {
              const active = selectedId === wh.id;
              const whName = localizedName(locale, wh);
              return (
                <Pressable
                  key={`${mode}-${line.inventoryItemId}-${wh.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onPick(line.inventoryItemId, wh.id)}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: theme.spacing.sm + 2,
                    paddingVertical: 8,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.border,
                    backgroundColor: active ? colors.brandSoft : colors.surface,
                  }}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={active ? colors.brand : colors.textMuted}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText
                      variant="caption"
                      weight={active ? 'semibold' : 'medium'}
                      numberOfLines={1}
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {whName}
                      {wh.isDefault ? ' ★' : ''}
                    </AppText>
                    {wh.availableQty != null ? (
                      <AppText
                        variant="caption"
                        color="muted"
                        dir="ltr"
                        style={{ marginTop: 1, textAlign: isRTL ? 'right' : 'left' }}
                      >
                        {wh.availableQty} {line.unit}
                      </AppText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (!allowed) return null;

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
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                color: colors.brand,
                letterSpacing: locale === 'ar' ? 0 : 0.6,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                fontSize: 11,
                flex: 1,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('mobile.tasks.materialsFloorTitle')}
            </AppText>
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
            >
              {t('mobile.tasks.materialsFloorCaption')}
            </AppText>
          </View>
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.tasks.scanMaterial')}
            disabled={scanning || loading}
            onPress={() => void onScan()}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: theme.spacing.sm + 2,
              paddingVertical: 6,
              borderRadius: theme.radius.full,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
            }}
          >
            <Ionicons name="qr-code-outline" size={14} color={colors.brand} />
            <AppText variant="caption" weight="medium" style={{ color: colors.brand }}>
              {scanning ? t('mobile.tasks.scanning') : t('mobile.tasks.scanMaterialShort')}
            </AppText>
          </AnimatedPressable>
        </View>

        <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
          <AppText variant="caption" color="muted">
            {t('mobile.tasks.materialsFloorHint')}
          </AppText>

          {scanMessage ? (
            <AppText variant="caption" color="secondary">
              {scanMessage}
            </AppText>
          ) : null}

          {loading && lines.length === 0 ? (
            <View style={{ paddingVertical: theme.spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : lines.length === 0 ? (
            <AppText variant="body" color="muted">
              {t('mobile.tasks.materialsStageEmpty')}
            </AppText>
          ) : (
            lines.map((line) => {
              const name = localizedName(locale, line);
              const canReturn = line.selected && maxReturnQty(line) > 0;
              const showIssue = needsIssueWarehouse(line);
              return (
                <View
                  key={line.inventoryItemId}
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: line.selected ? colors.brand : colors.border,
                    backgroundColor: line.selected
                      ? colors.brandSoft
                      : colors.surfaceSecondary,
                    padding: theme.spacing.sm + 2,
                    gap: theme.spacing.sm,
                    opacity: line.selected ? 1 : 0.72,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <InventorySkuThumb uri={line.imageUrl} size={44} rounded="lg" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText variant="bodySecondary" weight={titleWeight} numberOfLines={2}>
                        {name}
                        {line.isExtra ? ` · ${t('mobile.tasks.materialExtraBadge')}` : ''}
                      </AppText>
                      {line.expectedQty > 0 ? (
                        <View style={{ marginTop: 2, gap: 2 }}>
                          <AppText
                            variant="caption"
                            color="muted"
                            numberOfLines={1}
                            style={{ textAlign: isRTL ? 'right' : 'left' }}
                          >
                            {t('mobile.tasks.materialLabelRequired')}: {line.expectedQty}{' '}
                            {line.unit}
                          </AppText>
                          {line.selected ? (
                            <AppText
                              variant="caption"
                              color="muted"
                              numberOfLines={1}
                              style={{ textAlign: isRTL ? 'right' : 'left' }}
                            >
                              {t('mobile.tasks.materialLabelUsed')}: {line.actualQty} {line.unit}
                              {line.scrapQty > 0
                                ? ` · ${t('mobile.tasks.materialLabelScrap')}: ${line.scrapQty}`
                                : ''}
                              {line.returnedQty > 0
                                ? ` · ${t('mobile.tasks.materialLabelUnused')}: ${line.returnedQty}`
                                : ''}
                            </AppText>
                          ) : null}
                        </View>
                      ) : line.isExtra ? (
                        <AppText
                          variant="caption"
                          color="muted"
                          numberOfLines={1}
                          style={{ marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}
                        >
                          {line.unit}
                        </AppText>
                      ) : null}
                    </View>

                    {line.selected ? (
                      <View
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('mobile.tasks.materialQtyDown')}
                          hitSlop={8}
                          onPress={() => bumpQty(line.inventoryItemId, -1)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.borderStrong,
                          }}
                        >
                          <Ionicons name="remove" size={16} color={colors.brand} />
                        </Pressable>
                        <View
                          style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            minWidth: 64,
                            height: 32,
                            borderRadius: theme.radius.md,
                            borderWidth: 1,
                            borderColor: colors.borderStrong,
                            backgroundColor: colors.surface,
                            paddingHorizontal: 6,
                            gap: 4,
                          }}
                        >
                          <TextInput
                            value={line.qtyText}
                            onChangeText={(v) => setQtyText(line.inventoryItemId, v)}
                            onBlur={() => blurQty(line.inventoryItemId)}
                            keyboardType="decimal-pad"
                            selectTextOnFocus
                            accessibilityLabel={t('mobile.tasks.materialLabelUsed')}
                            style={{
                              minWidth: 28,
                              flexGrow: 1,
                              padding: 0,
                              margin: 0,
                              color: colors.textPrimary,
                              textAlign: 'center',
                              fontSize: 15,
                              fontWeight: '600',
                              writingDirection: 'ltr',
                            }}
                          />
                          <AppText
                            variant="caption"
                            color="muted"
                            style={{ fontSize: 11, writingDirection: 'ltr' }}
                          >
                            {line.unit}
                          </AppText>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('mobile.tasks.materialQtyUp')}
                          hitSlop={8}
                          onPress={() => bumpQty(line.inventoryItemId, 1)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.borderStrong,
                          }}
                        >
                          <Ionicons name="add" size={16} color={colors.brand} />
                        </Pressable>
                      </View>
                    ) : null}

                    <AnimatedPressable
                      variant="button"
                      accessibilityRole="button"
                      accessibilityLabel={
                        line.selected
                          ? t('mobile.tasks.materialDeselect')
                          : t('mobile.tasks.materialSelect')
                      }
                      hitSlop={6}
                      onPress={() => toggleSelect(line.inventoryItemId)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: line.selected ? colors.brand : colors.borderStrong,
                      }}
                    >
                      <Ionicons
                        name={line.selected ? 'checkmark' : 'add'}
                        size={18}
                        color={line.selected ? colors.brand : colors.textMuted}
                      />
                    </AnimatedPressable>
                  </View>

                  {line.selected ? (
                    <TextInput
                      value={line.reasonNotes}
                      onChangeText={(v) => setNotes(line.inventoryItemId, v)}
                      placeholder={t('mobile.tasks.materialNotePlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: theme.radius.md,
                        paddingHorizontal: theme.spacing.sm + 2,
                        paddingVertical: theme.spacing.sm,
                        color: colors.textPrimary,
                        backgroundColor: colors.surface,
                        textAlign: isRTL ? 'right' : 'left',
                        fontSize: 14,
                        minHeight: 40,
                      }}
                    />
                  ) : null}

                  {line.selected && (canReturn || line.returnOpen) ? (
                    <View style={{ gap: theme.spacing.sm }}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => toggleReturnOpen(line.inventoryItemId)}
                        style={{
                          alignSelf: isRTL ? 'flex-end' : 'flex-start',
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: theme.spacing.sm + 2,
                          paddingVertical: 6,
                          borderRadius: theme.radius.full,
                          borderWidth: 1,
                          borderColor: line.returnOpen ? colors.brand : colors.borderStrong,
                          backgroundColor: colors.surface,
                        }}
                      >
                        <Ionicons
                          name={line.returnOpen ? 'return-down-back' : 'return-up-back-outline'}
                          size={14}
                          color={colors.brand}
                        />
                        <AppText variant="caption" weight="medium" style={{ color: colors.brand }}>
                          {t('mobile.tasks.materialLabelUnused')}
                        </AppText>
                      </Pressable>

                      {line.returnOpen ? (
                        <View style={{ gap: theme.spacing.sm }}>
                          <View
                            style={{
                              flexDirection: isRTL ? 'row-reverse' : 'row',
                              alignItems: 'center',
                              gap: theme.spacing.sm,
                            }}
                          >
                            <AppText
                              variant="caption"
                              color="muted"
                              style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                            >
                              {t('mobile.tasks.materialLabelUnused')}
                            </AppText>
                            <View
                              style={{
                                flexDirection: isRTL ? 'row-reverse' : 'row',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Pressable
                                accessibilityRole="button"
                                hitSlop={8}
                                onPress={() => bumpReturned(line.inventoryItemId, -1)}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 14,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: colors.surface,
                                  borderWidth: 1,
                                  borderColor: colors.borderStrong,
                                }}
                              >
                                <Ionicons name="remove" size={14} color={colors.brand} />
                              </Pressable>
                              <AppText
                                variant="bodySecondary"
                                weight="semibold"
                                dir="ltr"
                                style={{ minWidth: 36, textAlign: 'center' }}
                              >
                                {line.returnedQty}
                              </AppText>
                              <Pressable
                                accessibilityRole="button"
                                hitSlop={8}
                                onPress={() => bumpReturned(line.inventoryItemId, 1)}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 14,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: colors.surface,
                                  borderWidth: 1,
                                  borderColor: colors.borderStrong,
                                }}
                              >
                                <Ionicons name="add" size={14} color={colors.brand} />
                              </Pressable>
                            </View>
                          </View>
                          {line.returnedQty > 0
                            ? renderWarehousePicker(line, 'return')
                            : null}
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {line.selected ? (
                    <View style={{ gap: theme.spacing.sm }}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => toggleScrapOpen(line.inventoryItemId)}
                        style={{
                          alignSelf: isRTL ? 'flex-end' : 'flex-start',
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: theme.spacing.sm + 2,
                          paddingVertical: 6,
                          borderRadius: theme.radius.full,
                          borderWidth: 1,
                          borderColor: line.scrapOpen ? colors.brand : colors.borderStrong,
                          backgroundColor: colors.surface,
                        }}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.brand} />
                        <AppText variant="caption" weight="medium" style={{ color: colors.brand }}>
                          {t('mobile.tasks.materialLabelScrap')}
                        </AppText>
                      </Pressable>
                      {line.scrapOpen ? (
                        <View
                          style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            gap: theme.spacing.sm,
                          }}
                        >
                          <AppText
                            variant="caption"
                            color="muted"
                            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                          >
                            {t('mobile.tasks.materialLabelScrap')}
                          </AppText>
                          <View
                            style={{
                              flexDirection: isRTL ? 'row-reverse' : 'row',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Pressable
                              accessibilityRole="button"
                              hitSlop={8}
                              onPress={() => bumpScrap(line.inventoryItemId, -1)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: colors.surface,
                                borderWidth: 1,
                                borderColor: colors.borderStrong,
                              }}
                            >
                              <Ionicons name="remove" size={14} color={colors.brand} />
                            </Pressable>
                            <AppText
                              variant="bodySecondary"
                              weight="semibold"
                              dir="ltr"
                              style={{ minWidth: 36, textAlign: 'center' }}
                            >
                              {line.scrapQty}
                            </AppText>
                            <Pressable
                              accessibilityRole="button"
                              hitSlop={8}
                              onPress={() => bumpScrap(line.inventoryItemId, 1)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: colors.surface,
                                borderWidth: 1,
                                borderColor: colors.borderStrong,
                              }}
                            >
                              <Ionicons name="add" size={14} color={colors.brand} />
                            </Pressable>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {showIssue ? renderWarehousePicker(line, 'issue') : null}
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  },
);
