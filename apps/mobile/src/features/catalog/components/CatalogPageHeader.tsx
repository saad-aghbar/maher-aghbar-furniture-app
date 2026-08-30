import { View } from 'react-native';
import type { Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  showBack?: boolean;
  backFallback?: Href;
};

/** Pinned stack header — circular back + title. Does not scroll with the catalog. */
export function CatalogPageHeader({
  title,
  showBack = false,
  backFallback = '/(app)/(admin)/(tabs)' as Href,
}: Props) {
  const { locale, isRTL } = useLocale();
  const { theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
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
        variant="title"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        style={{
          paddingHorizontal: showBack ? leadSize + theme.spacing.sm : 0,
        }}
      >
        {title}
      </AppText>
    </View>
  );
}
