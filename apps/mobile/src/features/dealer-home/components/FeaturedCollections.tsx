import { Image, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { DealerGlassCard } from '@/features/dealer-ui/DealerGlassCard';
import { DealerSectionHeader } from '@/features/dealer-ui';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { DealerHomeCollection } from '../dealerHomeImagery';

type Props = {
  collections?: DealerHomeCollection[];
};

/** Square photo + compact caption — same footprint for every tile. */
const CARD_W = 156;
const PAD = 10;
const IMAGE = CARD_W - PAD * 2;
const CAPTION_H = 44;
const CARD_H = PAD + IMAGE + 8 + CAPTION_H + PAD;
/** Bottom/side room for card shadow (ScrollView otherwise clips it). */
const SHADOW_GUTTER_Y = 14;
const SHADOW_GUTTER_X = 8;

/**
 * Featured collections — photo-led tiles with balanced proportions (no dark overlays).
 */
export function FeaturedCollections({ collections = [] }: Props) {
  const { t, tPlural, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dark = colorScheme === 'dark';
  const goCatalog = () => router.push('/(app)/(customer)/(tabs)/catalog' as Href);

  if (collections.length === 0) return null;

  // Shadow on a non-transformed shell — AnimatedPressable scale would clip it.
  const cardLift = {
    ...theme.elevation.card,
    shadowOpacity: dark ? 0.55 : 0.2,
    shadowRadius: dark ? 22 : 18,
    shadowOffset: { width: 0, height: dark ? 12 : 10 },
    elevation: Platform.OS === 'android' ? 10 : Math.max(theme.elevation.card.elevation, 6),
  } as const;

  return (
    <View style={{ overflow: 'visible' }}>
      <DealerSectionHeader
        compact
        title={t('mobile.dealerHome.featuredCollections')}
        action={
          <Pressable
            onPress={() => {
              void haptics.selection();
              goCatalog();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.dealerHome.seeAll')}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <AppText variant="caption" weight="medium" style={{ color: colors.brand }}>
              {t('mobile.dealerHome.seeAll')}
            </AppText>
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={14}
              color={colors.brand}
            />
          </Pressable>
        }
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: theme.spacing.sm, overflow: 'visible' }}
        contentContainerStyle={{
          gap: theme.spacing.md + 4,
          paddingTop: 2,
          paddingBottom: SHADOW_GUTTER_Y,
          paddingHorizontal: SHADOW_GUTTER_X,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          overflow: 'visible',
        }}
      >
        {collections.map((item) => (
          <View
            key={item.id}
            style={{
              width: CARD_W,
              borderRadius: theme.radius.xl,
              backgroundColor: colors.surface,
              ...cardLift,
            }}
          >
            <AnimatedPressable
              variant="card"
              onPress={() => {
                void haptics.selection();
                goCatalog();
              }}
              accessibilityRole="button"
              accessibilityLabel={
                item.title ?? t(`mobile.dealerHome.collections.${item.titleKey}`)
              }
              style={{ width: CARD_W, borderRadius: theme.radius.xl }}
            >
              <DealerGlassCard
                intensity="soft"
                elevated={false}
                style={{ width: CARD_W, height: CARD_H }}
                contentStyle={{
                  padding: PAD,
                  gap: 8,
                  flexGrow: 1,
                }}
              >
                <View
                  style={{
                    width: IMAGE,
                    height: IMAGE,
                    borderRadius: theme.radius.md,
                    overflow: 'hidden',
                    backgroundColor: colors.brandSoft,
                  }}
                >
                  <Image
                    source={{ uri: item.imageUrl }}
                    resizeMode="cover"
                    style={{ width: '100%', height: '100%' }}
                    accessibilityIgnoresInvertColors
                  />
                </View>

                <View style={{ height: CAPTION_H, gap: 2, justifyContent: 'flex-start' }}>
                  <AppText
                    variant="caption"
                    weight={titleWeight}
                    style={{
                      color: colors.textPrimary,
                      fontSize: 13,
                      lineHeight: 16,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                    numberOfLines={1}
                  >
                    {item.title ?? t(`mobile.dealerHome.collections.${item.titleKey}`)}
                  </AppText>
                  <AppText
                    variant="caption"
                    style={{
                      color: colors.textMuted,
                      fontSize: 11,
                      lineHeight: 14,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                    numberOfLines={1}
                  >
                    {tPlural('mobile.dealerHome.collectionItems', item.itemCount)}
                  </AppText>
                </View>
              </DealerGlassCard>
            </AnimatedPressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
