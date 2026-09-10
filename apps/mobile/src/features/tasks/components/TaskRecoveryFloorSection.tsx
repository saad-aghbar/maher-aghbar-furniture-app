import { useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { AdminBomLine } from '@/api/modules/catalogAdmin';
import { listWarehouses } from '@/api/modules/inventory';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useToast } from '@/components/feedback/Toast';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { BomMaterialPickerSheet } from '@/features/catalog/components/BomMaterialPickerSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { InventorySheetBody } from '@/features/inventory/components/InventorySheetBody';
import { InventorySheetFooter } from '@/features/inventory/components/InventorySheetFooter';
import { DestinationPickSheet } from '@/features/purchasing/components/DestinationPickSheet';
import type { ReturnRecoveryLine } from '@/features/returns/api';
import {
  useDeleteRecoveryLineMutation,
  usePostRecoveryLineMutation,
  useRecordRecoveryLineMutation,
  useReturnQuery,
  useUpdateRecoveryLineMutation,
} from '@/features/returns/query';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import {
  RecoveryOutcomeTouchBar,
  RECOVERY_OUTCOMES,
  type RecoveryOutcome,
} from './RecoveryOutcomeTouchBar';
import {
  emptyDestGroup,
  newRecoveryKey,
  RecoveryDestinationBoard,
  RecoveryPlusTrigger,
  RecoverySavedLineCard,
  type RecoveryDestGroup,
  type RecoveryPartDraft,
} from './recoveryFloorCards';

type Props = {
  taskId: string;
  returnRequestId: string;
  returnPieceId: string;
  previewLines?: ReturnRecoveryLine[];
  readOnly?: boolean;
};

type RecoveryPayload = {
  pieceId: string;
  productionTaskId: string;
  label: string;
  quantity: number;
  unit?: string;
  outcome: RecoveryOutcome;
  inventoryItemId?: string;
  destinationWarehouseId?: string;
  destinationLocationId?: string;
};

function outcomeHintKey(outcome: RecoveryOutcome) {
  if (outcome === 'DISPOSE') return 'mobile.returns.recoveryHintDispose';
  if (outcome === 'DAMAGED') return 'mobile.returns.recoveryHintDamaged';
  return 'mobile.returns.recoveryHintRecover';
}

function partFromLine(line: ReturnRecoveryLine): RecoveryPartDraft {
  return {
    key: newRecoveryKey('p'),
    itemId: line.inventoryItemId ?? undefined,
    label: line.label,
    quantity: String(line.quantity),
    unit: line.unit || 'pcs',
  };
}

function partFromPick(line: AdminBomLine, locale: string): RecoveryPartDraft {
  const name =
    locale.startsWith('ar') ? line.nameAr || line.nameEn || line.sku : line.nameEn || line.nameAr || line.sku;
  return {
    key: newRecoveryKey('p'),
    itemId: line.inventoryItemId || undefined,
    sku: line.sku,
    label: name,
    quantity: String(line.qty || 1),
    unit: line.unit || 'pcs',
    imageUrl: line.imageUrl,
  };
}

export function TaskRecoveryFloorSection({
  taskId,
  returnRequestId,
  returnPieceId,
  previewLines,
  readOnly = false,
}: Props) {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { height: windowH } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const sheetHeight = Math.round(windowH * 0.82);
  const query = useReturnQuery(returnRequestId, !previewLines && Boolean(returnRequestId));
  const warehousesQuery = useQuery({
    queryKey: ['recovery-warehouses'],
    queryFn: listWarehouses,
    enabled: !previewLines,
  });
  const recordMutation = useRecordRecoveryLineMutation(returnRequestId);
  const updateMutation = useUpdateRecoveryLineMutation(returnRequestId);
  const deleteMutation = useDeleteRecoveryLineMutation(returnRequestId);
  const postMutation = usePostRecoveryLineMutation(returnRequestId);
  const piece = (query.data?.pieces ?? []).find((row) => row.id === returnPieceId);
  const lines = previewLines ?? piece?.recoveryLines ?? [];
  const warehouses = warehousesQuery.data ?? [];

  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [warehousePickOpen, setWarehousePickOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<RecoveryOutcome>('RECOVER_TO_INVENTORY');
  const [groups, setGroups] = useState<RecoveryDestGroup[]>([emptyDestGroup()]);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);

  const recover = outcome === 'RECOVER_TO_INVENTORY';
  const activeGroup = groups.find((group) => group.key === activeGroupKey) ?? groups[0];
  const existingSkus = (activeGroup?.parts ?? []).map((part) => part.sku).filter(Boolean) as string[];

  const warehousePickRows = useMemo(
    () => warehouses.filter((row) => row.isActive !== false),
    [warehouses],
  );

  function resetDraft() {
    const next = emptyDestGroup();
    setOutcome('RECOVER_TO_INVENTORY');
    setGroups([next]);
    setEditingId(null);
    setActiveGroupKey(next.key);
    setPickerOpen(false);
    setWarehousePickOpen(false);
  }

  function openAdd() {
    resetDraft();
    setOpen(true);
  }

  function openEdit(line: ReturnRecoveryLine) {
    const nextOutcome = (
      RECOVERY_OUTCOMES.includes(line.outcome as RecoveryOutcome)
        ? line.outcome
        : 'RECOVER_TO_INVENTORY'
    ) as RecoveryOutcome;
    const group: RecoveryDestGroup = {
      key: newRecoveryKey('d'),
      warehouseId: line.destinationWarehouseId ?? undefined,
      locationId: line.destinationLocationId ?? undefined,
      parts: [partFromLine(line)],
    };
    setEditingId(line.id);
    setOutcome(nextOutcome);
    setGroups([group]);
    setActiveGroupKey(group.key);
    setOpen(true);
  }

  function setOutcomeAndGroups(next: RecoveryOutcome) {
    setOutcome(next);
    if (next === 'RECOVER_TO_INVENTORY') {
      setGroups((prev) => (prev.length > 0 ? prev : [emptyDestGroup()]));
      return;
    }
    setGroups((prev) => {
      const parts = prev.flatMap((group) => group.parts);
      const key = prev[0]?.key ?? newRecoveryKey('d');
      return [
        {
          key,
          warehouseId: undefined,
          locationId: undefined,
          parts,
        },
      ];
    });
  }

  function updateGroup(key: string, patch: Partial<RecoveryDestGroup>) {
    setGroups((prev) => prev.map((group) => (group.key === key ? { ...group, ...patch } : group)));
  }

  function appendPart(groupKey: string, part: RecoveryPartDraft) {
    setGroups((prev) =>
      prev.map((group) =>
        group.key === groupKey ? { ...group, parts: [...group.parts, part] } : group,
      ),
    );
  }

  function bumpPart(groupKey: string, sku: string, itemId?: string) {
    setGroups((prev) =>
      prev.map((group) => {
        if (group.key !== groupKey) return group;
        return {
          ...group,
          parts: group.parts.map((part) => {
            const match = (sku && part.sku === sku) || (itemId && part.itemId === itemId);
            if (!match) return part;
            const next = Number(part.quantity) + 1;
            return { ...part, quantity: String(Number.isFinite(next) ? next : 1) };
          }),
        };
      }),
    );
  }

  function flatten(): RecoveryPayload[] | null {
    const rows: RecoveryPayload[] = [];
    for (const group of groups) {
      const parts = group.parts.filter((part) => Number(part.quantity) > 0 && part.label.trim());
      if (parts.length === 0) continue;
      if (recover) {
        if (!group.warehouseId) return null;
        const locations = warehouses.find((row) => row.id === group.warehouseId)?.locations ?? [];
        if (locations.length > 0 && !group.locationId) return null;
        for (const part of parts) {
          if (!part.itemId) return null;
          rows.push({
            pieceId: returnPieceId,
            productionTaskId: taskId,
            label: part.label.trim(),
            quantity: Number(part.quantity),
            unit: part.unit,
            outcome,
            inventoryItemId: part.itemId,
            destinationWarehouseId: group.warehouseId,
            destinationLocationId: group.locationId,
          });
        }
      } else {
        for (const part of parts) {
          rows.push({
            pieceId: returnPieceId,
            productionTaskId: taskId,
            label: part.label.trim(),
            quantity: Number(part.quantity),
            unit: part.unit,
            outcome,
            inventoryItemId: part.itemId,
          });
        }
      }
    }
    return rows.length > 0 ? rows : null;
  }

  async function saveAll() {
    const payloads = flatten();
    if (!payloads) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.returns.recoveryValidation') });
      return;
    }
    try {
      if (editingId) {
        const [first, ...rest] = payloads;
        if (!first) return;
        await updateMutation.mutateAsync({
          lineId: editingId,
          label: first.label,
          quantity: first.quantity,
          unit: first.unit,
          outcome: first.outcome,
          inventoryItemId: first.inventoryItemId,
          destinationWarehouseId: first.destinationWarehouseId,
          destinationLocationId: first.destinationLocationId ?? null,
        });
        for (const body of rest) {
          await recordMutation.mutateAsync(body);
        }
      } else {
        for (const body of payloads) {
          await recordMutation.mutateAsync(body);
        }
      }
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.returns.recoverySaved') });
      setOpen(false);
      resetDraft();
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.returns.recoverySaveFailed') });
    }
  }

  const saving = recordMutation.isPending || updateMutation.isPending;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <DealerBoard title={t('mobile.returns.recoveryTitle')} titleWeight={titleWeight}>
        {lines.length === 0 ? (
          <DealerEmptyPanel text={t('mobile.returns.recoveryEmpty')} nested />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {lines.map((line, index) => (
              <ListItemEnter key={line.id} index={index}>
                <RecoverySavedLineCard
                  line={line}
                  warehouses={warehouses}
                  readOnly={readOnly}
                  posting={postMutation.isPending}
                  onPost={() => {
                    void haptics.confirmMedium();
                    postMutation.mutate(line.id, {
                      onSuccess: () =>
                        showToast({
                          variant: 'success',
                          message: t('mobile.returns.recoveryPosted'),
                        }),
                      onError: () => {
                        void haptics.error();
                        showToast({
                          variant: 'error',
                          message: t('mobile.returns.recoverySaveFailed'),
                        });
                      },
                    });
                  }}
                  onEdit={() => {
                    void haptics.selection();
                    openEdit(line);
                  }}
                  onDelete={() => {
                    void haptics.selection();
                    deleteMutation.mutate(line.id, {
                      onSuccess: () =>
                        showToast({
                          variant: 'success',
                          message: t('mobile.returns.recoveryDeleted'),
                        }),
                      onError: () => {
                        void haptics.error();
                        showToast({
                          variant: 'error',
                          message: t('mobile.returns.recoverySaveFailed'),
                        });
                      },
                    });
                  }}
                />
              </ListItemEnter>
            ))}
          </View>
        )}
        {readOnly ? null : (
          <PrimaryButton
            label={t('mobile.returns.recoveryAdd')}
            accessibilityLabel={t('mobile.returns.recoveryAdd')}
            onPress={() => {
              void haptics.selection();
              openAdd();
            }}
            style={{
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
            }}
          />
        )}
      </DealerBoard>

      <BottomSheet
        open={open}
        onClose={() => {
          setOpen(false);
          resetDraft();
        }}
        expandable
        sheetHeight={sheetHeight}
        title={
          editingId ? t('mobile.returns.recoveryEdit') : t('mobile.returns.recoverySheetTitle')
        }
      >
        <View style={{ flex: 1, minHeight: 0, gap: theme.spacing.md }}>
          <RecoveryOutcomeTouchBar value={outcome} onChange={setOutcomeAndGroups} />
          <InventorySheetBody hint={t(outcomeHintKey(outcome))}>
            {groups.map((group) => (
              <RecoveryDestinationBoard
                key={group.key}
                group={group}
                warehouses={warehouses}
                recover={recover}
                canRemove={recover && groups.length > 1 && !editingId}
                onOpenWarehouse={() => {
                  setActiveGroupKey(group.key);
                  setWarehousePickOpen(true);
                }}
                onSelectLocation={(id) => updateGroup(group.key, { locationId: id })}
                onAddParts={() => {
                  setActiveGroupKey(group.key);
                  setPickerOpen(true);
                }}
                onRemoveDest={() => {
                  setGroups((prev) => {
                    const next = prev.filter((row) => row.key !== group.key);
                    return next.length > 0 ? next : [emptyDestGroup()];
                  });
                }}
                onChangePartQty={(partKey, qty) =>
                  updateGroup(group.key, {
                    parts: group.parts.map((part) =>
                      part.key === partKey ? { ...part, quantity: qty } : part,
                    ),
                  })
                }
                onRemovePart={(partKey) =>
                  updateGroup(group.key, {
                    parts: group.parts.filter((part) => part.key !== partKey),
                  })
                }
              />
            ))}
            {recover && !editingId ? (
              <RecoveryPlusTrigger
                label={t('mobile.returns.recoveryAddDestination')}
                onPress={() => {
                  const next = emptyDestGroup();
                  setGroups((prev) => [...prev, next]);
                  setActiveGroupKey(next.key);
                }}
              />
            ) : null}
          </InventorySheetBody>
          <InventorySheetFooter
            primaryLabel={t('mobile.returns.recoverySave')}
            onPrimary={() => {
              void saveAll();
            }}
            onSecondary={() => {
              setOpen(false);
              resetDraft();
            }}
            loading={saving}
            disabled={saving}
            cancelWhileLoading
          />
        </View>
      </BottomSheet>

      <BomMaterialPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        hideCost
        keepOpenOnPick
        title={t('mobile.returns.recoveryAddParts')}
        hint={t('mobile.returns.recoveryPickHint')}
        existingSkus={existingSkus}
        onPickExisting={({ id, sku }) => {
          if (!activeGroup) return;
          bumpPart(activeGroup.key, sku, id);
        }}
        onPick={(line) => {
          if (!activeGroup) return;
          const already = activeGroup.parts.some(
            (part) => part.sku === line.sku || (line.inventoryItemId && part.itemId === line.inventoryItemId),
          );
          if (already) {
            bumpPart(activeGroup.key, line.sku, line.inventoryItemId || undefined);
            return;
          }
          appendPart(activeGroup.key, partFromPick(line, locale));
        }}
      />

      <DestinationPickSheet
        open={warehousePickOpen}
        overlay
        mode="warehouse"
        warehouses={warehousePickRows}
        selectedWarehouseId={activeGroup?.warehouseId ?? ''}
        searchPlaceholder={t('mobile.returns.recoverySearchWarehouse')}
        onClose={() => setWarehousePickOpen(false)}
        onSelectWarehouse={(id) => {
          if (!activeGroup) return;
          const prev = activeGroup.warehouseId;
          updateGroup(activeGroup.key, {
            warehouseId: id,
            locationId: prev === id ? activeGroup.locationId : undefined,
          });
        }}
      />
    </View>
  );
}
