import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { localizedName } from '@maher/i18n';
import type { SpecOptionGroup, SpecOptionValue } from '@/api/modules/catalog';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { selectActiveSpecOptionGroups, selectSpecOptionValuesForPicker } from '../selectSpecOptions';
import { SpecOptionChips } from './SpecOptionChips';
import { SpecOptionPickerSheet } from './SpecOptionPickerSheet';
import { AnimatedPressable, haptics } from '@/motion';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

type Props = {
  groups: SpecOptionGroup[];
  values: SpecOptionValue[];
  selectedByGroup: Record<string, string | null>;
  onChange: (groupId: string, valueId: string | null) => void;
  /** Close nested pickers when the host sheet dismisses. */
  hostOpen?: boolean;
  /** Stack the value picker on another sheet (host yields). */
  pickerOverlay?: boolean;
};

/** One labelled control per option group — never a catch-all text box. */
export function VariantOptionGroupsBoard({
  groups,
  values,
  selectedByGroup,
  onChange,
  hostOpen,
  pickerOverlay = false,
}: Props) {
  const { t, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [pickerGroupId, setPickerGroupId] = useState<string | null>(null);
  const activeGroups = selectActiveSpecOptionGroups(groups);
  const pickerGroup = activeGroups.find((g) => g.id === pickerGroupId) ?? null;
  const pickerValues = pickerGroup ? selectSpecOptionValuesForPicker(values, pickerGroup.id) : [];

  useEffect(() => {
    if (hostOpen === false) setPickerGroupId(null);
  }, [hostOpen]);

  if (!activeGroups.length) return null;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {activeGroups.map((group) => {
        const groupValues = selectSpecOptionValuesForPicker(values, group.id);
        const selectedId = selectedByGroup[group.id] ?? null;
        const selected = groupValues.find((v) => v.id === selectedId);
        if (groupValues.length <= 6) {
          return (
            <View key={group.id} style={{ gap: theme.spacing.sm }}>
              <AppText variant="label" weight={titleWeight}>
                {localizedName(locale, group)}
              </AppText>
              <SpecOptionChips
                values={groupValues}
                selectedId={selectedId}
                onSelect={(id) => onChange(group.id, id)}
              />
            </View>
          );
        }
        return (
          <View key={group.id} style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" weight={titleWeight}>
              {localizedName(locale, group)}
            </AppText>
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('catalog.pickOptionGroup', { group: localizedName(locale, group) })}
              onPress={() => {
                void haptics.selection();
                setPickerGroupId(group.id);
              }}
              style={{
                minHeight: theme.sizes.touch.min,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                paddingHorizontal: theme.spacing.md,
                justifyContent: 'center',
                ...orderBoardShadow(colorScheme),
              }}
            >
              <AppText variant="body">
                {selected ? localizedName(locale, selected) : t('catalog.noSpecOption')}
              </AppText>
            </AnimatedPressable>
          </View>
        );
      })}
      <SpecOptionPickerSheet
        open={Boolean(pickerGroup)}
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
    </View>
  );
}
