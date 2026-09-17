import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
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
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { CodeField } from '@/components/forms/CodeField';
import { useCodeScanner } from '@/components/scan/CodeScannerProvider';
import { useToast } from '@/components/feedback/Toast';
import { listWarehouses, type Warehouse } from '@/features/inventory/api';
import {
  locationsForWarehouse,
  WarehouseBinStrip,
} from '@/features/inventory/components/WarehouseBinBoard';
import { pickDefaultLocationId } from '@/features/inventory/pickDefaultLocation';
import { BomMaterialPickerSheet } from '@/features/catalog/components/BomMaterialPickerSheet';
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
import { pickDefaultWarehouseId } from '../task-material-warehouse';

type DraftWarehouse = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  availableQty?: number;
  isDefault?: boolean;
  locations?: Warehouse['locations'];
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
  issueLocationId: string | null;
  returnLocationId: string | null;
  warehouses: DraftWarehouse[];
  returnOpen: boolean;
  scrapOpen: boolean;
};

export type TaskMaterialsFloorHandle = {
  /** True when at least one material is selected with qty &gt; 0. */
  hasSelection: () => boolean;
  /** Persist current draft (selected + deselected zeros). */
  commit: () => Promise<void>;
  /** Open the material QR scanner (dock + board share this). */
  openScan: () => void;
};

type Props = {
  taskId: string;
  enabled?: boolean;
  /** Finished / cancelled — show recorded usage, no add/edit/scan. */
  readOnly?: boolean;
};

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
    issueLocationId: row.issueLocationId ?? null,
    returnLocationId: row.returnLocationId ?? null,
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
    locations: 'locations' in w ? w.locations : undefined,
  }));
}

function binsOf(warehouseId: string | null | undefined, list: DraftWarehouse[]) {
  const wh = list.find((row) => row.id === warehouseId);
  return locationsForWarehouse({
    id: warehouseId ?? '',
    locations: wh?.locations,
  });
}

/**
 * Inline raw materials on Task details — full BOM strips, select + qty + notes.
 */
export const TaskMaterialsFloorSection = forwardRef<TaskMaterialsFloorHandle, Props>(
  function TaskMaterialsFloorSection({ taskId, enabled = true, readOnly = false }, ref) {
    const { user } = useAuth();
    const { t, locale, isRTL } = useLocale();
    const { colors, theme, colorScheme } = useTheme();
    const { showToast } = useToast();
    const { openScanner } = useCodeScanner();
    const allowed = enabled && can(user, 'production.material-usage.record');
    const canMutate = allowed && !readOnly;
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [typedCode, setTypedCode] = useState('');
    const [lines, setLines] = useState<DraftLine[]>([]);
    const [scanMessage, setScanMessage] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [rawWarehouses, setRawWarehouses] = useState<DraftWarehouse[]>([]);
    const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
    const onScanRef = useRef<() => void>(() => {});

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

    useEffect(() => {
      if (!allowed) return;
      void loadRawWarehousesFallback().then(setRawWarehouses);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allowed]);

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
          if (readOnly || lines.length === 0) return;
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
              issueLocationId: line.selected ? line.issueLocationId : null,
              returnLocationId: line.selected ? line.returnLocationId : null,
            })),
          );
        },
        openScan: () => onScanRef.current(),
      }),
      [assertWarehouseSelection, lines, readOnly, taskId],
    );

    function toggleSelect(inventoryItemId: string) {
      if (!canMutate) return;
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
              issueLocationId: null,
              returnLocationId: null,
            };
          }
          const nextQty =
            line.actualQty > 0
              ? line.actualQty
              : line.expectedQty > 0
                ? line.expectedQty
                : 1;
          const needsIssue = line.isExtra || nextQty > line.expectedQty;
          const warehouses =
            line.warehouses.length > 0 ? line.warehouses : rawWarehouses;
          return {
            ...line,
            selected: true,
            actualQty: nextQty,
            qtyText: String(nextQty),
            warehouses,
            issueWarehouseId: needsIssue
              ? line.issueWarehouseId ?? pickDefaultWarehouseId(warehouses)
              : line.issueWarehouseId,
          };
        }),
      );
    }

    function bumpQty(inventoryItemId: string, dir: 1 | -1) {
      if (!canMutate) return;
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
      if (!canMutate) return;
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
      if (!canMutate) return;
      setLines((prev) =>
        prev.map((line) => {
          if (line.inventoryItemId !== inventoryItemId) return line;
          const next = line.actualQty > 0 ? line.actualQty : 0;
          return { ...line, actualQty: next, qtyText: String(next) };
        }),
      );
    }

    function bumpReturned(inventoryItemId: string, dir: 1 | -1) {
      if (!canMutate) return;
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
      if (!canMutate) return;
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
      if (!canMutate) return;
      setLines((prev) =>
        prev.map((line) =>
          line.inventoryItemId === inventoryItemId ? { ...line, reasonNotes } : line,
        ),
      );
    }

    function setIssueWarehouse(inventoryItemId: string, issueWarehouseId: string) {
      if (!canMutate) return;
      void haptics.selection();
      setLines((prev) =>
        prev.map((line) =>
          line.inventoryItemId === inventoryItemId
            ? {
                ...line,
                issueWarehouseId,
                issueLocationId:
                  pickDefaultLocationId(
                    binsOf(issueWarehouseId, [...line.warehouses, ...rawWarehouses]),
                  ) || null,
              }
            : line,
        ),
      );
    }

    function setReturnWarehouse(inventoryItemId: string, returnWarehouseId: string) {
      if (!canMutate) return;
      void haptics.selection();
      setLines((prev) =>
        prev.map((line) =>
          line.inventoryItemId === inventoryItemId
            ? {
                ...line,
                returnWarehouseId,
                returnLocationId:
                  pickDefaultLocationId(
                    binsOf(returnWarehouseId, [...line.warehouses, ...rawWarehouses]),
                  ) || null,
              }
            : line,
        ),
      );
    }

    function setIssueLocation(inventoryItemId: string, issueLocationId: string) {
      if (!canMutate) return;
      void haptics.selection();
      setLines((prev) =>
        prev.map((line) =>
          line.inventoryItemId === inventoryItemId ? { ...line, issueLocationId } : line,
        ),
      );
    }

    function setReturnLocation(inventoryItemId: string, returnLocationId: string) {
      if (!canMutate) return;
      void haptics.selection();
      setLines((prev) =>
        prev.map((line) =>
          line.inventoryItemId === inventoryItemId ? { ...line, returnLocationId } : line,
        ),
      );
    }

    function toggleReturnOpen(inventoryItemId: string) {
      if (!canMutate) return;
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
      if (!canMutate) return;
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

    function selectExistingMaterial(inventoryItemId: string) {
      if (!canMutate) return;
      setLines((prev) =>
        prev.map((line) => {
          if (line.inventoryItemId !== inventoryItemId) return line;
          const nextQty =
            line.actualQty > 0 ? line.actualQty : line.expectedQty > 0 ? line.expectedQty : 1;
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
      setPickerOpen(false);
      void haptics.confirmLight();
    }

    async function addPickedMaterial(item: {
      id: string;
      sku: string;
      nameEn: string;
      nameAr: string;
      nameHe?: string | null;
      unit: string;
      imageUrl?: string | null;
      qty?: number;
    }) {
      const existing = lines.find((l) => l.inventoryItemId === item.id);
      if (existing) {
        selectExistingMaterial(item.id);
        return;
      }
      const fallbackWh =
        rawWarehouses.length > 0 ? rawWarehouses : await loadRawWarehousesFallback();
      const warehouses = warehousesFromApi(fallbackWh);
      if (warehouses.length && rawWarehouses.length === 0) setRawWarehouses(warehouses);
      const qty = item.qty && item.qty > 0 ? item.qty : 1;
      setLines((prev) => {
        if (prev.some((l) => l.inventoryItemId === item.id)) return prev;
        return [
          ...prev,
          {
            inventoryItemId: item.id,
            sku: item.sku,
            nameEn: item.nameEn,
            nameAr: item.nameAr,
            nameHe: item.nameHe,
            imageUrl: item.imageUrl,
            unit: item.unit ?? 'pcs',
            expectedQty: 0,
            actualQty: qty,
            qtyText: String(qty),
            returnedQty: 0,
            scrapQty: 0,
            reasonNotes: '',
            isExtra: true,
            selected: true,
            issueWarehouseId: pickDefaultWarehouseId(warehouses),
            returnWarehouseId: null,
            issueLocationId:
              pickDefaultLocationId(binsOf(pickDefaultWarehouseId(warehouses), warehouses)) ||
              null,
            returnLocationId: null,
            warehouses,
            returnOpen: false,
            scrapOpen: false,
          },
        ];
      });
      setPickerOpen(false);
      void haptics.confirmLight();
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
            locations: w.locations,
          }));
      } catch {
        return [];
      }
    }

    async function onScan(typed?: string) {
      if (!canMutate) return;
      setScanMessage(null);
      setScanning(true);
      try {
        const code = typed?.trim()
          ? typed.trim()
          : await openScanner({
              title: t('mobile.tasks.scanMaterialTitle'),
              hint: t('mobile.tasks.scanMaterialHint'),
            });
        if (!code?.trim()) return;
        const result = await identifyTaskMaterial(taskId, code.trim());
        if (result.status === 'MATCH') {
          void haptics.confirmLight();
          const scannedWh = warehousesFromApi(result.warehouses ?? []);
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
              const warehouses =
                scannedWh.length > 0
                  ? scannedWh
                  : line.warehouses.length > 0
                    ? line.warehouses
                    : rawWarehouses;
              return {
                ...line,
                selected: true,
                actualQty: nextQty,
                qtyText: String(nextQty),
                warehouses,
                issueWarehouseId: needsIssue
                  ? result.suggestedWarehouseId ??
                    line.issueWarehouseId ??
                    pickDefaultWarehouseId(warehouses)
                  : line.issueWarehouseId,
              };
            }),
          );
          const matchMsg = t('mobile.tasks.scanMaterialMatch', { sku: result.sku });
          setScanMessage(matchMsg);
          showToast({ variant: 'success', message: matchMsg });
          setPickerOpen(false);
        } else if (result.status === 'EXTRA') {
          void haptics.selection();
          const scannedWh = warehousesFromApi(result.warehouses ?? []);
          const fallbackWh =
            scannedWh.length > 0
              ? scannedWh
              : rawWarehouses.length > 0
                ? rawWarehouses
                : await loadRawWarehousesFallback();
          setLines((prev) => {
            if (prev.some((l) => l.inventoryItemId === result.inventoryItemId)) {
              return prev.map((l) => {
                if (l.inventoryItemId !== result.inventoryItemId) return l;
                const nextQty = l.actualQty > 0 ? l.actualQty : 1;
                const warehouses =
                  scannedWh.length > 0
                    ? scannedWh
                    : l.warehouses.length > 0
                      ? l.warehouses
                      : warehousesFromApi(fallbackWh);
                return {
                  ...l,
                  selected: true,
                  actualQty: nextQty,
                  qtyText: String(nextQty),
                  isExtra: true,
                  warehouses,
                  issueWarehouseId:
                    result.suggestedWarehouseId ??
                    l.issueWarehouseId ??
                    pickDefaultWarehouseId(warehouses),
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
                issueWarehouseId:
                  result.suggestedWarehouseId ?? pickDefaultWarehouseId(warehouses),
                returnWarehouseId: null,
                issueLocationId:
                  pickDefaultLocationId(
                    binsOf(
                      result.suggestedWarehouseId ?? pickDefaultWarehouseId(warehouses),
                      warehouses,
                    ),
                  ) || null,
                returnLocationId: null,
                warehouses,
                returnOpen: false,
                scrapOpen: false,
              },
            ];
          });
          const extraMsg = t('mobile.tasks.scanMaterialExtra', { sku: result.sku });
          setScanMessage(extraMsg);
          showToast({ variant: 'success', message: extraMsg });
          setPickerOpen(false);
        } else if (result.status === 'WRONG') {
          void haptics.error();
          const wrongMsg = t('mobile.tasks.scanMaterialWrong', {
            sku: result.scannedSku,
            expected: result.expectedSkus.join(', '),
          });
          setScanMessage(wrongMsg);
          showToast({ variant: 'error', message: wrongMsg });
        } else {
          void haptics.error();
          const missMsg = t('mobile.tasks.scanMaterialNotFound', { code: result.code });
          setScanMessage(missMsg);
          showToast({ variant: 'error', message: missMsg });
        }
      } catch {
        void haptics.error();
        const failMsg = t('mobile.tasks.scanMaterialFailed');
        setScanMessage(failMsg);
        showToast({ variant: 'error', message: failMsg });
      } finally {
        setScanning(false);
      }
    }
    onScanRef.current = () => {
      void onScan();
    };

    function warehousesForLine(line: DraftLine): DraftWarehouse[] {
      return line.warehouses.length > 0 ? line.warehouses : rawWarehouses;
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
      const options = warehousesForLine(line);

      if (options.length === 0) {
        return (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.tasks.materialWarehouseUnavailable')}
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
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
            }}
          >
            {options.map((wh) => {
              const active = selectedId === wh.id;
              const whName = localizedName(locale, wh);
              return (
                <AnimatedPressable
                  key={`${mode}-${line.inventoryItemId}-${wh.id}`}
                  variant="button"
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={whName}
                  onPress={() => onPick(line.inventoryItemId, wh.id)}
                  style={{
                    minHeight: 40,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1.5,
                    borderColor: active ? colors.brand : colors.border,
                    backgroundColor: active ? colors.brandSoft : colors.surface,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    overflow: 'hidden',
                    justifyContent: 'center',
                  }}
                >
                  {active ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: 3,
                        backgroundColor: colors.brand,
                        opacity: 0.55,
                        ...(isRTL ? { right: 0 } : { left: 0 }),
                      }}
                    />
                  ) : null}
                  <AppText
                    variant="label"
                    weight={active ? titleWeight : 'medium'}
                    numberOfLines={1}
                    style={{
                      color: active ? colors.brand : colors.textPrimary,
                      textAlign: isRTL ? 'right' : 'left',
                      paddingLeft: active && !isRTL ? 4 : 0,
                      paddingRight: active && isRTL ? 4 : 0,
                    }}
                  >
                    {whName}
                    {wh.availableQty != null ? ` · ${wh.availableQty}` : ''}
                  </AppText>
                </AnimatedPressable>
              );
            })}
          </View>
          {(() => {
            const bins = binsOf(selectedId, [...options, ...rawWarehouses]);
            if (bins.length === 0) return null;
            const selectedLoc =
              mode === 'issue' ? line.issueLocationId : line.returnLocationId;
            const onLoc = mode === 'issue' ? setIssueLocation : setReturnLocation;
            return (
              <WarehouseBinStrip
                locations={bins}
                selectedId={pickDefaultLocationId(bins, selectedLoc)}
                onSelect={(id) => onLoc(line.inventoryItemId, id)}
                label={
                  mode === 'issue'
                    ? t('mobile.tasks.materialTakeFromBin')
                    : t('mobile.tasks.materialReturnToBin')
                }
              />
            );
          })()}
        </View>
      );
    }

    if (!allowed) return null;

    return (
      <>
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
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ gap: 2 }}>
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
          {canMutate ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
          <AnimatedPressable
            variant="button"
            testID="task-add-material"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.tasks.addMaterial')}
            onPress={() => {
              void haptics.selection();
              setPickerOpen(true);
            }}
            style={{
              width: theme.sizes.touch.min,
              height: theme.sizes.touch.min,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
            }}
          >
            <Ionicons name="add" size={20} color={colors.brand} />
          </AnimatedPressable>
            </View>
          ) : null}
        </View>

        <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
          {canMutate ? (
            <CodeField
              value={typedCode}
              onChangeText={setTypedCode}
              placeholder={t('mobile.tasks.scanMaterialHint')}
              returnKeyType="go"
              onSubmitEditing={() => {
                const code = typedCode.trim();
                if (code) void onScan(code);
              }}
              onScanned={(code) => void onScan(code)}
              scanTitle={t('mobile.tasks.scanMaterialTitle')}
              scanHint={t('mobile.tasks.scanMaterialHint')}
            />
          ) : null}
          {canMutate ? (
            <SecondaryButton
              testID="task-scan-material"
              label={scanning ? t('mobile.tasks.scanning') : t('mobile.tasks.scanMaterial')}
              accessibilityLabel={t('mobile.tasks.scanMaterial')}
              onPress={() => void onScan()}
              loading={scanning}
              disabled={loading}
              leading={
                <Ionicons name="qr-code-outline" size={18} color={colors.brand} />
              }
            />
          ) : null}
          {canMutate ? (
            <AppText variant="caption" color="muted">
              {t('mobile.tasks.materialsFloorHint')}
            </AppText>
          ) : null}

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
                    <AnimatedPressable
                      variant="card"
                      accessibilityRole="button"
                      accessibilityLabel={
                        line.selected
                          ? t('mobile.tasks.materialDeselect')
                          : t('mobile.tasks.materialSelect')
                      }
                      onPress={() => toggleSelect(line.inventoryItemId)}
                      style={{
                        flex: 1,
                        minWidth: 0,
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
                    </AnimatedPressable>

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
                            editable={canMutate}
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

                  {showIssue ? renderWarehousePicker(line, 'issue') : null}

                  {line.selected ? (
                    <TextInput
                      value={line.reasonNotes}
                      onChangeText={(v) => setNotes(line.inventoryItemId, v)}
                      placeholder={t('mobile.tasks.materialNotePlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      editable={canMutate}
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
                </View>
              );
            })
          )}
        </View>
      </View>
      <BomMaterialPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        hideCost
        title={t('mobile.tasks.addMaterialTitle')}
        hint={t('mobile.tasks.addMaterialHint')}
        existingLabel={t('mobile.tasks.materialAlreadyOnStage')}
        existingSkus={lines.map((line) => line.sku)}
        onRequestScan={() => {
          setPickerOpen(false);
          void onScan();
        }}
        onPickExisting={(row) => {
          selectExistingMaterial(row.id);
        }}
        onPick={(line) => {
          if (!line.inventoryItemId) {
            showToast({
              variant: 'error',
              message: t('mobile.tasks.scanMaterialFailed'),
            });
            return;
          }
          void addPickedMaterial({
            id: line.inventoryItemId,
            sku: line.sku,
            nameEn: line.nameEn,
            nameAr: line.nameAr,
            unit: line.unit ?? 'pcs',
            imageUrl: line.imageUrl,
            qty: line.qty,
          });
        }}
      />
      </>
    );
  },
);
