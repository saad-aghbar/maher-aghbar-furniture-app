import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useLocale } from '@/i18n';
import { useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { Href } from 'expo-router';
import { CatalogFilterButton } from './CatalogFilterButton';

type Props = {
  titleKey: string;
  searchInput: string;
  onSearchChange: (text: string) => void;
  filterActiveCount: number;
  onOpenFilters: () => void;
  showBack?: boolean;
  backFallback?: Href;
  children?: ReactNode;
};

/** Catalog header — title + search/filter row (scrolls with the list). */
export function CatalogStoreChrome({
  titleKey,
  searchInput,
  onSearchChange,
  filterActiveCount,
  onOpenFilters,
  showBack = false,
  backFallback = '/(app)/(admin)/(tabs)' as Href,
  children,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme } = useTheme();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const leadSize = theme.sizes.touch.min;

  const body = (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          minHeight: leadSize,
          justifyContent: 'center',
        }}
      >
        {showBack ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...(isRTL ? { right: 0 } : { left: 0 }),
              zIndex: 1,
              justifyContent: 'center',
            }}
          >
            <ScreenBackLead fallback={backFallback} />
          </View>
        ) : null}
        <AppText
          variant="largeTitle"
          weight={titleWeight}
          align="center"
          numberOfLines={1}
          style={{
            paddingHorizontal: showBack ? leadSize + theme.spacing.sm : 0,
          }}
        >
          {t(titleKey)}
        </AppText>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <TextField
            value={searchInput}
            onChangeText={onSearchChange}
            placeholder={t('mobile.catalog.searchPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('mobile.catalog.search')}
          />
        </View>
        <CatalogFilterButton activeCount={filterActiveCount} onPress={onOpenFilters} />
      </View>

      {children}
    </View>
  );

  if (reduce) return body;
  return (
    <Animated.View entering={FadeInDown.duration(280)}>
      {body}
    </Animated.View>
  );
}
