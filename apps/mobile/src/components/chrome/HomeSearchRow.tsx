import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { ChromeCircleButton } from '@/components/chrome/ChromeCircleButton';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { chromeSizes, useTheme } from '@/theme';

type Props = {
  placeholder: string;
  onSearchPress: () => void;
  filterA11y?: string;
  onFilterPress?: () => void;
};

/** Pill search + chocolate filter — home language (image 1). */
export function HomeSearchRow({
  placeholder,
  onSearchPress,
  filterA11y,
  onFilterPress,
}: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
        alignItems: 'center',
      }}
    >
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        onPress={() => {
          void haptics.selection();
          onSearchPress();
        }}
        style={{ flex: 1 }}
      >
        <SearchBarShell>
          <AppText variant="body" color="muted" style={{ flex: 1 }} numberOfLines={1}>
            {placeholder}
          </AppText>
        </SearchBarShell>
      </Pressable>
      {onFilterPress ? (
        <ChromeCircleButton
          accessibilityLabel={filterA11y ?? t('common.filter')}
          onPress={onFilterPress}
          filled
          size={chromeSizes.filter}
        >
          <Ionicons name="options-outline" size={20} color={colors.onBrand} />
        </ChromeCircleButton>
      ) : null}
    </View>
  );
}
