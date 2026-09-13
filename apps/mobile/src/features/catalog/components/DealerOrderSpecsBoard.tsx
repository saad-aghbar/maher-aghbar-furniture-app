import { useState } from 'react';
import { View } from 'react-native';
import { localizedName } from '@maher/i18n';
import type { SpecOptionGroup, SpecOptionValue } from '@/api/modules/catalog';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import {
  applyOptionToLine,
  isNamedDealerSpec,
  type NewOrderLine,
} from '@/features/requests/newOrderLine';
import {
  addNamedSpecToLine,
  removeNamedSpecFromLine,
} from '@/features/requests/seedModifiedLineFromVariant';
import {
  CappedNestedScroll,
  CatalogFloorEmpty,
  FLOOR_ROW_ESTIMATE,
} from './CatalogFloorList';
import { CatalogSectionBoard } from './CatalogSectionBoard';
import { DealerAddSpecSheet } from './DealerAddSpecSheet';
import { SpecFloorRow } from './SpecFloorRow';
import { SpecOptionPickerSheet } from './SpecOptionPickerSheet';
import {
  selectAssignedSpecRows,
  selectSpecOptionValuesForPicker,
  selectUnusedSpecGroups,
} from '../selectSpecOptions';

type Props = {
  line: NewOrderLine;
  onChange: (next: NewOrderLine) => void;
  groups: SpecOptionGroup[];
  values: SpecOptionValue[];
  titleWeight: 'medium' | 'semibold';
};

/**
 * Assigned variant specs + dealer-named specs for this modified order.
 * Library picks only — naming a spec does not POST to the catalog.
 */
export function DealerOrderSpecsBoard({
  line,
  onChange,
  groups,
  values,
  titleWeight,
}: Props) {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const [addOpen, setAddOpen] = useState(false);
  const [pickerGroupId, setPickerGroupId] = useState<string | null>(null);
  const [editingNamedCode, setEditingNamedCode] = useState<string | null>(null);

  const selectedByGroup: Record<string, string | null> = {};
  for (const opt of line.options) {
    if (opt.groupId && opt.specOptionValueId) {
      selectedByGroup[opt.groupId] = opt.specOptionValueId;
    }
  }

  const assigned = selectAssignedSpecRows(groups, values, selectedByGroup);
  const named = line.options.filter(isNamedDealerSpec);
  const unused = selectUnusedSpecGroups(groups, selectedByGroup);
  const pickerGroup = groups.find((g) => g.id === pickerGroupId) ?? null;
  const pickerValues = pickerGroup
    ? selectSpecOptionValuesForPicker(values, pickerGroup.id)
    : [];
  const editingNamed = named.find((opt) => opt.code === editingNamedCode) ?? null;
  const ticketCount = assigned.length + named.length;

  return (
    <>
      <CatalogSectionBoard
        title={t('catalog.specs')}
        titleWeight={titleWeight}
        actionLabel={t('catalog.addSpec')}
        onAction={() => {
          setEditingNamedCode(null);
          setAddOpen(true);
        }}
      >
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="caption" color="muted">
            {t('mobile.newOrder.modifySpecsHint')}
          </AppText>
          {ticketCount === 0 ? (
            <CatalogFloorEmpty
              icon="pricetag-outline"
              title={t('catalog.noSpecs')}
              body={t('mobile.newOrder.modifyNoSpecsBody')}
            />
          ) : (
            <CappedNestedScroll
              itemCount={ticketCount}
              rowEstimate={FLOOR_ROW_ESTIMATE.spec}
              gap={theme.spacing.sm}
              visibleRows={4}
            >
              {assigned.map((row) => {
                const category = localizedName(locale, row.group);
                const name = localizedName(locale, row.value);
                return (
                  <SpecFloorRow
                    key={row.group.id}
                    category={category}
                    name={name}
                    hex={row.value.hex}
                    onEdit={() => setPickerGroupId(row.group.id)}
                    onRemove={() => onChange(applyOptionToLine(line, row.group, null))}
                  />
                );
              })}
              {named.map((opt) => {
                const category = locale === 'ar' ? opt.nameAr || opt.nameEn || '' : opt.nameEn || opt.nameAr || '';
                return (
                  <SpecFloorRow
                    key={opt.code ?? opt.nameEn}
                    category={category || t('mobile.newOrder.ownSpec')}
                    name={opt.note || '—'}
                    onEdit={() => {
                      setEditingNamedCode(opt.code ?? null);
                      setAddOpen(true);
                    }}
                    onRemove={() =>
                      onChange(removeNamedSpecFromLine(line, opt.code ?? ''))
                    }
                  />
                );
              })}
            </CappedNestedScroll>
          )}
        </View>
      </CatalogSectionBoard>

      <DealerAddSpecSheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setEditingNamedCode(null);
        }}
        unusedGroups={editingNamed ? [] : unused}
        editing={
          editingNamed
            ? {
                label: editingNamed.nameEn || editingNamed.nameAr || '',
                value: editingNamed.note || '',
              }
            : null
        }
        onPickLibraryGroup={(groupId) => {
          setAddOpen(false);
          setPickerGroupId(groupId);
        }}
        onAddNamed={(label, value) => {
          onChange(addNamedSpecToLine(line, label, value, editingNamed?.code));
          setAddOpen(false);
          setEditingNamedCode(null);
        }}
      />

      <SpecOptionPickerSheet
        open={Boolean(pickerGroup)}
        onClose={() => setPickerGroupId(null)}
        values={pickerValues}
        selectedId={pickerGroup ? selectedByGroup[pickerGroup.id] ?? null : null}
        onSelect={(id) => {
          if (!pickerGroup) return;
          const value = values.find((row) => row.id === id) ?? null;
          onChange(
            applyOptionToLine(
              line,
              pickerGroup,
              value
                ? {
                    id: value.id,
                    code: value.code,
                    nameEn: value.nameEn,
                    nameAr: value.nameAr,
                  }
                : null,
            ),
          );
          setPickerGroupId(null);
        }}
        title={pickerGroup ? localizedName(locale, pickerGroup) : t('catalog.pickSpecOption')}
      />
    </>
  );
}
