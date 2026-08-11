import { Image, Platform, ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { BrowseCategory } from '../api';
import { categoryRailImageUrl } from '../categoryRailImagery';

type Props = {
  categories: BrowseCategory[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
};

const TILE_W = 88;
const TILE_H = 104;

/** Visual category rail — photo tiles + All. */
export function DealerCategoryRail({ categories, value, onChange }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const labelFor = (cat: BrowseCategory) => {
    if (locale === 'ar') return cat.nameAr || cat.nameEn;
    if (locale === 'he') return cat.nameHe || cat.nameEn;
    return cat.nameEn || cat.nameAr;
  };

  const lift = {
    ...theme.elevation.rest,
    shadowOpacity: dark ? 0.4 : 0.12,
    elevation: Platform.OS === 'android' ? 4 : theme.elevation.rest.elevation,
  } as const;

  const tiles: { id: string | null; label: string; imageUrl?: string }[] = [
    { id: null, label: t('mobile.catalog.chips.all') },
    ...categories.map((c) => ({
      id: c.id,
      label: labelFor(c),
      imageUrl: categoryRailImageUrl(c.id),
    })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ overflow: 'visible' }}
      contentContainerStyle={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
        paddingVertical: 6,
        paddingHorizontal: 2,
      }}
    >
      {tiles.map((tile) => {
        const active = tile.id === value;
        return (
          <AnimatedPressable
            key={tile.id ?? 'all'}
            variant="card"
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tile.label}
            onPress={() => {
              void haptics.selection();
              onChange(tile.id);
            }}
            style={{
              width: TILE_W,
              height: TILE_H,
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surface,
              borderWidth: active ? 2 : 1,
              borderColor: active ? colors.brand : colors.border,
              overflow: 'hidden',
              ...lift,
            }}
          >
            {tile.imageUrl ? (
              <Image
                source={{ uri: tile.imageUrl }}
                style={{ width: '100%', height: 58 }}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View
                style={{
                  height: 58,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: active ? colors.brand : colors.textSecondary }}
                >
                  {tile.label.slice(0, 1)}
                </AppText>
              </View>
            )}
            <View
              style={{
                flex: 1,
                paddingHorizontal: 6,
                justifyContent: 'center',
                backgroundColor: active ? colors.brandSoft : colors.surface,
              }}
            >
              <AppText
                variant="caption"
                weight={active ? titleWeight : 'medium'}
                numberOfLines={2}
                style={{
                  fontSize: 11,
                  lineHeight: 13,
                  textAlign: 'center',
                  color: active ? colors.brand : colors.textPrimary,
                }}
              >
                {tile.label}
              </AppText>
            </View>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}
