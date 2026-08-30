import { ScrollView, useWindowDimensions, View } from 'react-native';
import { DatePickerField } from '@/components/calendar/DatePickerField';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { FG_FILTERS, fgFilterLabel, type FgFilter } from '../fgFilters';
import type { FinishedBoardScope } from '../selectFinishedOrders';
import type { InventoryWarehouseOption } from './InventoryWarehousePickerControl';
import {
  InventoryFilterSection,
  InventoryFilterSheetFooter,
  InventoryFloorChip,
  InventoryWarehouseSearchPicker,
} from './InventoryFilterSheetChrome';

export type FinishedFilterDraft = {
  scope: FinishedBoardScope;
  warehouseId: string | null;
  fgFilter: FgFilter;
  historyFrom: string;
  historyTo: string;
};

export type FinishedFilterDefaults = {
  historyFrom: string;
  historyTo: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  draft: FinishedFilterDraft;
  onChange: (draft: FinishedFilterDraft) => void;
  onApply: () => void;
  onReset: () => void;
  warehouses: InventoryWarehouseOption[];
  defaults: FinishedFilterDefaults;
};

export function defaultFinishedFilterDraft(
  defaults: FinishedFilterDefaults,
): FinishedFilterDraft {
  return {
    scope: 'inWarehouse',
    warehouseId: null,
    fgFilter: 'all',
    historyFrom: defaults.historyFrom,
    historyTo: defaults.historyTo,
  };
}

export function countActiveFinishedFilters(
  draft: FinishedFilterDraft,
  defaults: FinishedFilterDefaults,
): number {
  let n = 0;
  if (draft.scope !== 'inWarehouse') n += 1;
  if (draft.warehouseId) n += 1;
  if (draft.scope === 'inWarehouse' && draft.fgFilter !== 'all') n += 1;
  if (
    draft.scope === 'history' &&
    (draft.historyFrom !== defaults.historyFrom || draft.historyTo !== defaults.historyTo)
  ) {
    n += 1;
  }
  return n;
}

/**
 * Finished Goods board filters — Orders-style draft/apply sheet.
 */
export function InventoryFinishedFilterSheet({
  open,
  onClose,
  draft,
  onChange,
  onApply,
  onReset,
  warehouses,
  defaults,
}: Props) {
  const { t, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.88), 720);
  const activeCount = countActiveFinishedFilters(draft, defaults);

  const chipRow = {
    flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  };

  let section = 0;
  const nextIndex = () => {
    const i = section;
    section += 1;
    return i;
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.inventory.filterTitle')}
      fitContent
      maxHeight={sheetHeight}
    >
      <View style={{ gap: theme.spacing.md }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: sheetHeight - 168 }}
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.sm,
          }}
        >
          <InventoryFilterSection
            index={nextIndex()}
            reduce={reduce}
            icon="layers-outline"
            title={t('mobile.inventory.filterBoard')}
            accent={draft.scope !== 'inWarehouse' ? colors.brand : undefined}
          >
            <View style={chipRow}>
              <InventoryFloorChip
                label={t('mobile.inventory.fgScopeInWarehouse')}
                active={draft.scope === 'inWarehouse'}
                stretch
                onPress={() => {
                  void haptics.selection();
                  onChange({ ...draft, scope: 'inWarehouse' });
                }}
              />
              <InventoryFloorChip
                label={t('mobile.inventory.fgScopeHistory')}
                active={draft.scope === 'history'}
                stretch
                onPress={() => {
                  void haptics.selection();
                  onChange({ ...draft, scope: 'history', fgFilter: 'all' });
                }}
              />
            </View>
          </InventoryFilterSection>

          {warehouses.length > 1 ? (
            <InventoryFilterSection
              index={nextIndex()}
              reduce={reduce}
              icon="business-outline"
              title={t('mobile.inventory.filterWarehouse')}
              accent={draft.warehouseId ? colors.brand : undefined}
            >
              <InventoryWarehouseSearchPicker
                warehouses={warehouses}
                selectedId={draft.warehouseId}
                resetToken={open}
                onSelect={(warehouseId) => onChange({ ...draft, warehouseId })}
              />
            </InventoryFilterSection>
          ) : null}

          {draft.scope === 'inWarehouse' ? (
            <InventoryFilterSection
              index={nextIndex()}
              reduce={reduce}
              icon="time-outline"
              title={t('mobile.inventory.filterLeaveStatus')}
              accent={draft.fgFilter !== 'all' ? colors.brand : undefined}
            >
              <View style={chipRow}>
                {FG_FILTERS.map((filter) => (
                  <InventoryFloorChip
                    key={filter}
                    label={fgFilterLabel(filter, t)}
                    active={draft.fgFilter === filter}
                    onPress={() => {
                      void haptics.selection();
                      onChange({ ...draft, fgFilter: filter });
                    }}
                  />
                ))}
              </View>
            </InventoryFilterSection>
          ) : (
            <InventoryFilterSection
              index={nextIndex()}
              reduce={reduce}
              icon="calendar-outline"
              title={t('mobile.inventory.filterHistoryRange')}
              accent={
                draft.historyFrom !== defaults.historyFrom ||
                draft.historyTo !== defaults.historyTo
                  ? colors.brand
                  : undefined
              }
            >
              <View style={{ gap: theme.spacing.sm }}>
                <AppText
                  variant="caption"
                  color="secondary"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.inventory.fgHistoryHint')}
                </AppText>
                <DatePickerField
                  label={t('mobile.inventory.fgHistoryFrom')}
                  value={draft.historyFrom}
                  onChange={(ymd) => onChange({ ...draft, historyFrom: ymd })}
                />
                <DatePickerField
                  label={t('mobile.inventory.fgHistoryTo')}
                  value={draft.historyTo}
                  onChange={(ymd) => onChange({ ...draft, historyTo: ymd })}
                />
              </View>
            </InventoryFilterSection>
          )}
        </ScrollView>

        <InventoryFilterSheetFooter
          activeCount={activeCount}
          onReset={onReset}
          onApply={onApply}
        />
      </View>
    </BottomSheet>
  );
}
