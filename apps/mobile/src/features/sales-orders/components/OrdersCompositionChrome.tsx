import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { OrdersFilterButton } from './OrdersFilterButton';

type Props = {
  title?: string;
  searchInput: string;
  setSearchInput: (v: string) => void;
  onOpenFilters: () => void;
  filterActiveCount?: number;
  children?: ReactNode;
};

/**
 * Orders page chrome — production-style eyebrow + title + subtitle,
 * then search and optional children (approval chips, stage spine).
 */
export function OrdersCompositionChrome({
  title,
  searchInput,
  setSearchInput,
  onOpenFilters,
  filterActiveCount = 0,
  children,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme, colors } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const heading = title ?? t('mobile.orders.title');

  return (
    <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: theme.spacing.xs, minWidth: 0 }}>
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            style={{
              letterSpacing: locale === 'ar' ? 0 : 1.4,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              color: colors.brand,
            }}
          >
            {t('mobile.orders.pulseEyebrow')}
          </AppText>
          <AppText variant="title" weight={titleWeight}>
            {heading}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            numberOfLines={1}
            style={{ fontSize: 12, lineHeight: 16 }}
          >
            {t('mobile.orders.subtitle')}
          </AppText>
        </View>
        <OrdersFilterButton onPress={onOpenFilters} activeCount={filterActiveCount} />
      </View>

      <TextField
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder={t('mobile.orders.searchPlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {children}
    </View>
  );
}
