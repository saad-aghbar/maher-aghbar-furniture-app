import { ScrollView, useWindowDimensions, View } from 'react-native';
import { DatePickerField } from '@/components/calendar/DatePickerField';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { SemiOrderFilter } from '../selectSemiOrders';
import type { InventoryWarehouseOption } from './InventoryWarehousePickerControl';
import {
  InventoryFilterSection,
  InventoryFilterSheetFooter,
  InventoryFloorChip,
  InventoryWarehouseSearchPicker,
} from './InventoryFilterSheetChrome';

export type SemiFilterDraft = {
  scope: SemiOrderFilter;
  warehouseId: string | null;
  historyFrom: string;
  historyTo: string;
};

export type SemiFilterDefaults = {
  historyFrom: string;
  historyTo: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  draft: SemiFilterDraft;
  onChange: (draft: SemiFilterDraft) => void;
  onApply: () => void;
  onReset: () => void;
  warehouses: InventoryWarehouseOption[];
  defaults: SemiFilterDefaults;
  /** When false, hide warehouse section (detail screens with no WH list). */
  showWarehouse?: boolean;
  /** When false, hide history date fields (scope-only screens). */
  showHistoryDates?: boolean;
};

export function defaultSemiFilterDraft(defaults: SemiFilterDefaults): SemiFilterDraft {
  return {
    scope: 'active',
    warehouseId: null,
    historyFrom: defaults.historyFrom,
    historyTo: defaults.historyTo,
  };
}

export function countActiveSemiFilters(
  draft: SemiFilterDraft,
  defaults: SemiFilterDefaults,
  opts?: { includeWarehouse?: boolean; includeHistoryDates?: boolean },
): number {
  const includeWarehouse = opts?.includeWarehouse !== false;
  const includeHistoryDates = opts?.includeHistoryDates !== false;
  let n = 0;
  if (draft.scope !== 'active') n += 1;
  if (includeWarehouse && draft.warehouseId) n += 1;
  if (
    includeHistoryDates &&
    draft.scope === 'history' &&
    (draft.historyFrom !== defaults.historyFrom || draft.historyTo !== defaults.historyTo)
  ) {
    n += 1;
  }
  return n;
}

/**
 * Semi-finished board filters — Orders-style draft/apply sheet.
 */
export function InventorySemiFilterSheet({
  open,
  onClose,
  draft,
  onChange,
  onApply,
  onReset,
  warehouses,
  defaults,
  showWarehouse = true,
  showHistoryDates = true,
}: Props) {
  const { t, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.88), 720);
  const activeCount = countActiveSemiFilters(draft, defaults, {
    includeWarehouse: showWarehouse && warehouses.length > 1,
    includeHistoryDates: showHistoryDates,
  });

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
            accent={draft.scope !== 'active' ? colors.brand : undefined}
          >
            <View style={chipRow}>
              <InventoryFloorChip
                label={t('mobile.inventory.semiOrderFilterActive')}
                active={draft.scope === 'active'}
                stretch
                onPress={() => {
                  void haptics.selection();
                  onChange({ ...draft, scope: 'active' });
                }}
              />
              <InventoryFloorChip
                label={t('mobile.inventory.semiOrderFilterHistory')}
                active={draft.scope === 'history'}
                stretch
                onPress={() => {
                  void haptics.selection();
                  onChange({ ...draft, scope: 'history' });
                }}
              />
            </View>
          </InventoryFilterSection>

          {showWarehouse && warehouses.length > 1 ? (
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

          {showHistoryDates && draft.scope === 'history' ? (
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
                  {t('mobile.inventory.semiHistoryHint')}
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
          ) : null}
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
