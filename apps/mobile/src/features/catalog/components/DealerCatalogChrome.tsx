import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { BrandMark } from '@/components/BrandMark';
import {
  DealerSearchBar,
} from '@/features/dealer-ui';
import { useLocale } from '@/i18n';
import { rowDirection } from '@/i18n/rtl';
import { useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { CatalogBrowseMode } from '../catalogBrowseMode';
import type { BrowseCategory } from '../api';
import { SearchActionRow } from '@/components/layout/SearchActionRow';
import { CatalogFilterButton } from './CatalogFilterButton';
import { DealerCatalogModeTabs } from './DealerCatalogModeTabs';
import { DealerCategoryRail } from './DealerCategoryRail';

type Props = {
  titleKey: string;
  subtitleKey?: string;
  searchInput: string;
  onSearchChange: (text: string) => void;
  filterActiveCount: number;
  onOpenFilters: () => void;
  categories: BrowseCategory[];
  categoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  browseMode: CatalogBrowseMode;
  onBrowseModeChange: (mode: CatalogBrowseMode) => void;
  /** Hide category rail in Favorites / Ordered modes. */
  showCategories?: boolean;
};

/** Dealer catalog header — brand hero, modes, search, category rail. */
export function DealerCatalogChrome({
  titleKey,
  subtitleKey = 'mobile.catalog.shopHint',
  searchInput,
  onSearchChange,
  filterActiveCount,
  onOpenFilters,
  categories,
  categoryId,
  onCategoryChange,
  browseMode,
  onBrowseModeChange,
  showCategories = true,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const body = (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: rowDirection(isRTL),
          alignItems: 'center',
          gap: theme.spacing.md,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            ...theme.elevation.rest,
          }}
        >
          <BrandMark variant="monogram" size="md" style={{ height: 22, width: 24 }} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText
            variant="caption"
            weight="medium"
            style={{
              color: colors.brand,
              textAlign: isRTL ? 'right' : 'left',
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              fontSize: 11,
            }}
          >
            {t('mobile.catalog.eyebrow')}
          </AppText>
          <AppText
            variant="heading"
            weight={titleWeight}
            style={{
              color: colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
              fontSize: 24,
              lineHeight: 30,
            }}
          >
            {t(titleKey)}
          </AppText>
          <AppText
            variant="caption"
            style={{
              color: colors.textSecondary,
              textAlign: isRTL ? 'right' : 'left',
              lineHeight: 16,
            }}
            numberOfLines={2}
          >
            {t(subtitleKey)}
          </AppText>
        </View>
      </View>

      <DealerCatalogModeTabs value={browseMode} onChange={onBrowseModeChange} />

      <SearchActionRow
        trailing={
          <CatalogFilterButton activeCount={filterActiveCount} onPress={onOpenFilters} />
        }
      >
        <DealerSearchBar
          value={searchInput}
          onChangeText={onSearchChange}
          placeholder={t('mobile.catalog.searchPlaceholder')}
          accessibilityLabel={t('mobile.catalog.search')}
        />
      </SearchActionRow>

      {showCategories ? (
        <DealerCategoryRail
          categories={categories}
          value={categoryId}
          onChange={onCategoryChange}
        />
      ) : null}
    </View>
  );

  if (reduce) return body;
  return (
    <Animated.View entering={FadeInDown.duration(280)}>
      {body}
    </Animated.View>
  );
}
