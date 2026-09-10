import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';

type Props = {
  query: string;
  onQueryChange: (next: string) => void;
  filterActive?: boolean;
  onOpenFilters: () => void;
};

export function SchedulingHeaderBoard({
  query,
  onQueryChange,
  filterActive = false,
  onOpenFilters,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <AppText
          variant="caption"
          style={{
            color: colors.brand,
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
          }}
        >
          {t('mobile.adminScheduling.eyebrow')}
        </AppText>
        <AppText variant="largeTitle" weight={titleWeight}>
          {t('mobile.adminScheduling.title')}
        </AppText>
        <AppText variant="body" color="secondary" style={{ textAlign: 'center' }}>
          {t('mobile.adminScheduling.subtitle')}
        </AppText>
      </View>

      <DealerBoard>
        <SearchBarShell>
          <AppTextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder={t('mobile.adminScheduling.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={{
              flex: 1,
              minWidth: 0,
              paddingVertical: theme.spacing.sm,
              fontSize: 16,
              color: colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
              ...resolveAppFontStyle(locale, { variant: 'body' }),
            }}
          />
        </SearchBarShell>
        <AnimatedPressable
          variant="button"
          onPress={() => {
            void haptics.selection();
            onOpenFilters();
          }}
          accessibilityRole="button"
          style={{
            marginTop: theme.spacing.sm,
            minHeight: 48,
            borderRadius: theme.radius.lg,
            borderWidth: 1.5,
            borderColor: filterActive ? colors.brand : colors.borderStrong,
            backgroundColor: filterActive ? colors.brandSoft : colors.surface,
            paddingHorizontal: theme.spacing.md,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <Ionicons name="options-outline" size={16} color={colors.brand} />
          </View>
          <AppText variant="body" weight={titleWeight} style={{ flex: 1 }}>
            {t('mobile.adminScheduling.filters')}
          </AppText>
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={16}
            color={colors.textMuted}
          />
        </AnimatedPressable>
      </DealerBoard>
    </View>
  );
}
