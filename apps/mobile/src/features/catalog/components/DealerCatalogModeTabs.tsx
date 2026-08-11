import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  CATALOG_BROWSE_MODES,
  type CatalogBrowseMode,
} from '../catalogBrowseMode';

type Props = {
  value: CatalogBrowseMode;
  onChange: (mode: CatalogBrowseMode) => void;
};

const MODE_LABEL_KEY: Record<CatalogBrowseMode, string> = {
  all: 'mobile.catalog.modes.all',
  favorites: 'mobile.catalog.modes.favorites',
  ordered: 'mobile.catalog.modes.ordered',
};

/** All / Favorites / Ordered segmented control. */
export function DealerCatalogModeTabs({ value, onChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        padding: 4,
        borderRadius: theme.radius.xl,
        backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(63,52,44,0.06)',
        borderWidth: 1,
        borderColor: colors.border,
        gap: 4,
      }}
    >
      {CATALOG_BROWSE_MODES.map((mode) => {
        const active = mode === value;
        return (
          <AnimatedPressable
            key={mode}
            variant="button"
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(MODE_LABEL_KEY[mode])}
            onPress={() => {
              void haptics.selection();
              onChange(mode);
            }}
            style={{
              flex: 1,
              minHeight: 36,
              borderRadius: theme.radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.sm,
              backgroundColor: active ? colors.surface : 'transparent',
              borderWidth: active ? 1 : 0,
              borderColor: active ? colors.border : 'transparent',
              ...(active ? theme.elevation.rest : null),
            }}
          >
            <AppText
              variant="caption"
              weight={active ? titleWeight : 'medium'}
              style={{
                color: active ? colors.textPrimary : colors.textSecondary,
                fontSize: 12,
                lineHeight: 16,
              }}
              numberOfLines={1}
            >
              {t(MODE_LABEL_KEY[mode])}
            </AppText>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}
