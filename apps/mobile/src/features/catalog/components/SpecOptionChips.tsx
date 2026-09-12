import { ScrollView } from 'react-native';
import { localizedName } from '@maher/i18n';
import type { SpecOptionValue } from '@/api/modules/catalog';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { rowDirection } from '@/i18n/rtl';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { selectSpecOptionValuesForPicker } from '../selectSpecOptions';

type Props = {
  values: SpecOptionValue[];
  selectedId: string | null;
  onSelect: (valueId: string | null) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

/** Chip-select for short spec-option lists (foam, piping, finish). */
export function SpecOptionChips({
  values,
  selectedId,
  onSelect,
  allowEmpty = true,
  emptyLabel,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const activeValues = selectSpecOptionValuesForPicker(values);

  const chips: { id: string | null; label: string }[] = [
    ...(allowEmpty ? [{ id: null as string | null, label: emptyLabel ?? t('catalog.noSpecOption') }] : []),
    ...activeValues.map((v) => ({ id: v.id, label: localizedName(locale, v) })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: rowDirection(isRTL),
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
      }}
    >
      {chips.map((chip) => {
        const active = chip.id === selectedId;
        return (
          <AnimatedPressable
            key={chip.id ?? 'none'}
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={chip.label}
            accessibilityState={{ selected: active }}
            testID={`spec-option-chip-${chip.id ?? 'none'}`}
            onPress={() => {
              void haptics.selection();
              onSelect(chip.id);
            }}
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.sm,
              minHeight: 40,
              borderRadius: theme.radius.full,
              backgroundColor: active ? colors.brand : colors.surface,
              borderWidth: 1,
              borderColor: active ? colors.brand : colors.borderStrong,
              justifyContent: 'center',
            }}
          >
            <AppText
              variant="label"
              weight={active ? titleWeight : 'medium'}
              style={{ color: active ? colors.onBrand : colors.textPrimary }}
            >
              {chip.label}
            </AppText>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}
