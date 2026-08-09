import { ScrollView } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { BrowseCategory } from '../api';

type CatalogFilterChipsProps = {
  categories: BrowseCategory[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
};

/** Pill categories — solid brand when active (store mockup language). */
export function CatalogFilterChips({
  categories,
  value,
  onChange,
}: CatalogFilterChipsProps) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const labelFor = (cat: BrowseCategory) => {
    if (locale === 'ar') return cat.nameAr || cat.nameEn;
    if (locale === 'he') return cat.nameHe || cat.nameEn;
    return cat.nameEn || cat.nameAr;
  };

  const chips: { id: string | null; label: string }[] = [
    { id: null, label: t('mobile.catalog.chips.all') },
    ...categories.map((c) => ({ id: c.id, label: labelFor(c) })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
      }}
    >
      {chips.map((chip) => {
        const active = chip.id === value;
        return (
          <AnimatedPressable
            key={chip.id ?? 'all'}
            variant="button"
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              void haptics.selection();
              onChange(chip.id);
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
