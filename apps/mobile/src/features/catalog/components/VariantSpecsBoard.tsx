import { useState } from 'react';
import { View } from 'react-native';
import { localizedName } from '@maher/i18n';
import type { SpecOptionGroup, SpecOptionValue } from '@/api/modules/catalog';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import {
  CappedNestedScroll,
  CatalogFloorEmpty,
  FLOOR_ROW_ESTIMATE,
} from './CatalogFloorList';
import { CatalogSectionBoard } from './CatalogSectionBoard';
import { SpecFloorRow } from './SpecFloorRow';
import { SpecOptionPickerSheet } from './SpecOptionPickerSheet';
import { VariantSpecEditSheet } from './VariantSpecEditSheet';
import {
  selectActiveSpecOptionGroups,
  selectAssignedSpecRows,
  selectSpecOptionValuesForPicker,
} from '../selectSpecOptions';

type Props = {
  groups: SpecOptionGroup[];
  values: SpecOptionValue[];
  selectedByGroup: Record<string, string | null>;
  onChange: (groupId: string, valueId: string | null) => void;
  /** Ledger: only pinned specs, add / name / categorize. Picker: every group as a ticket. */
  compose?: boolean;
  titleWeight?: 'medium' | 'semibold';
  hostOpen?: boolean;
  pickerOverlay?: boolean;
};

export function VariantSpecsBoard({
  groups,
  values,
  selectedByGroup,
  onChange,
  compose = false,
  titleWeight,
  hostOpen,
  pickerOverlay = false,
}: Props) {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const weight = titleWeight ?? (locale === 'ar' ? 'medium' : 'semibold');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [pickerGroupId, setPickerGroupId] = useState<string | null>(null);

  const assigned = selectAssignedSpecRows(groups, values, selectedByGroup);
  const pickerGroups = selectActiveSpecOptionGroups(groups);
  const pickerGroup = pickerGroups.find((g) => g.id === pickerGroupId) ?? null;
  const pickerValues = pickerGroup
    ? selectSpecOptionValuesForPicker(values, pickerGroup.id)
    : [];

  const tickets: Array<{ group: SpecOptionGroup; value: SpecOptionValue | null }> = compose
    ? assigned
    : pickerGroups.map((group) => ({
        group,
        value: values.find((v) => v.id === selectedByGroup[group.id]) ?? null,
      }));

  if (!compose && pickerGroups.length === 0) return null;

  const list = (
    <View style={{ gap: theme.spacing.md }}>
      {compose ? (
        <AppText variant="caption" color="muted">
          {t('catalog.specsHint')}
        </AppText>
      ) : null}
      {tickets.length === 0 ? (
        <CatalogFloorEmpty
          icon="pricetag-outline"
          title={t('catalog.noSpecs')}
          body={t('catalog.noSpecsBody')}
        />
      ) : (
        <CappedNestedScroll
          itemCount={tickets.length}
          rowEstimate={FLOOR_ROW_ESTIMATE.spec}
          gap={theme.spacing.sm}
          visibleRows={4}
        >
          {tickets.map((row) => {
            const category = localizedName(locale, row.group);
            const name = row.value
              ? localizedName(locale, row.value)
              : t('catalog.noSpecOption');
            return (
              <SpecFloorRow
                key={row.group.id}
                category={category}
                name={name}
                hex={row.value?.hex}
                empty={!row.value}
                onPress={compose ? undefined : () => setPickerGroupId(row.group.id)}
                onEdit={
                  compose
                    ? () => {
                        setEditingGroupId(row.group.id);
                        setSheetOpen(true);
                      }
                    : undefined
                }
                onRemove={compose ? () => onChange(row.group.id, null) : undefined}
              />
            );
          })}
        </CappedNestedScroll>
      )}
    </View>
  );

  const sheets = compose ? (
    <VariantSpecEditSheet
      open={sheetOpen}
      onClose={() => {
        setSheetOpen(false);
        setEditingGroupId(null);
      }}
      groups={groups}
      values={values}
      selectedByGroup={selectedByGroup}
      editingGroupId={editingGroupId}
      onPin={(groupId, valueId) => onChange(groupId, valueId)}
    />
  ) : (
    <SpecOptionPickerSheet
      open={Boolean(pickerGroup) && hostOpen !== false}
      onClose={() => setPickerGroupId(null)}
      values={pickerValues}
      selectedId={pickerGroup ? selectedByGroup[pickerGroup.id] ?? null : null}
      onSelect={(id) => {
        if (pickerGroup) onChange(pickerGroup.id, id);
        setPickerGroupId(null);
      }}
      title={pickerGroup ? localizedName(locale, pickerGroup) : t('catalog.pickSpecOption')}
      overlay={pickerOverlay}
    />
  );

  if (!compose) {
    return (
      <View style={{ gap: theme.spacing.md }}>
        {list}
        {sheets}
      </View>
    );
  }

  return (
    <>
      <CatalogSectionBoard
        title={t('catalog.specs')}
        titleWeight={weight}
        actionLabel={t('catalog.addSpec')}
        onAction={() => {
          setEditingGroupId(null);
          setSheetOpen(true);
        }}
      >
        {list}
      </CatalogSectionBoard>
      {sheets}
    </>
  );
}
