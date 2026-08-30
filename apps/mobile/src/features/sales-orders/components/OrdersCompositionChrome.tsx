import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { DealerSearchBar } from '@/features/dealer-ui';
import { alignStart, localeRow, useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { OrdersFilterButton } from './OrdersFilterButton';
import { OrdersSearchBar } from './OrdersSearchBar';

type Props = {
  title?: string;
  /** Defaults to `mobile.orders.pulseEyebrow`. */
  eyebrow?: string;
  /** Defaults to `mobile.orders.subtitle`. */
  subtitle?: string;
  searchInput: string;
  setSearchInput: (v: string) => void;
  onOpenFilters: () => void;
  filterActiveCount?: number;
  /** Dealer portal — touch-bar track + cream inner pill search. */
  dealerSearch?: boolean;
  children?: ReactNode;
};

/**
 * Orders page chrome — production-style eyebrow + title + subtitle,
 * then search and optional children (approval chips, stage spine).
 */
export function OrdersCompositionChrome({
  title,
  eyebrow,
  subtitle,
  searchInput,
  setSearchInput,
  onOpenFilters,
  filterActiveCount = 0,
  dealerSearch = false,
  children,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme, colors } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const heading = title ?? t('mobile.orders.title');
  const eyebrowLabel = eyebrow ?? t('mobile.orders.pulseEyebrow');
  const subtitleLabel = subtitle ?? t('mobile.orders.subtitle');
  const searchPlaceholder = t('mobile.orders.searchPlaceholder');

  return (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: localeRow(isRTL),
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View
          style={{
            flex: 1,
            gap: theme.spacing.xs,
            minWidth: 0,
            alignItems: alignStart(isRTL),
          }}
        >
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            align="start"
            style={{
              letterSpacing: locale === 'ar' ? 0 : 1.4,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              color: colors.brand,
            }}
          >
            {eyebrowLabel}
          </AppText>
          <AppText variant="largeTitle" weight={titleWeight} align="start">
            {heading}
          </AppText>
          <AppText
            variant="caption"
            numberOfLines={2}
            align="start"
            style={{
              fontSize: 12,
              lineHeight: 16,
              color: colors.brand,
            }}
          >
            {subtitleLabel}
          </AppText>
        </View>
        <OrdersFilterButton onPress={onOpenFilters} activeCount={filterActiveCount} />
      </View>

      {dealerSearch ? (
        <DealerSearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={searchPlaceholder}
        />
      ) : (
        <OrdersSearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={searchPlaceholder}
        />
      )}
      {children}
    </View>
  );
}
