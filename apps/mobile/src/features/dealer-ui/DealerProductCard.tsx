import { Image, Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  priceLabel?: string;
  categoryLabel?: string | null;
  imageUri?: string | null;
  width?: number;
  index?: number;
  favorited?: boolean;
  orderedBefore?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
};

export function DealerProductCard({
  title,
  priceLabel,
  categoryLabel,
  imageUri,
  width,
  index = 0,
  favorited = false,
  orderedBefore = false,
  onPress,
  onToggleFavorite,
}: Props) {
  const { isRTL, locale, t } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const lift = {
    ...theme.elevation.card,
    shadowOpacity: dark ? 0.5 : 0.16,
    shadowRadius: dark ? 18 : 14,
    shadowOffset: { width: 0, height: dark ? 10 : 8 },
    elevation: Platform.OS === 'android' ? 8 : Math.max(theme.elevation.card.elevation, 5),
  } as const;

  return (
    <ListItemEnter index={index}>
      <View
        style={{
          width: width ?? undefined,
          flex: width ? undefined : 1,
          marginBottom: theme.spacing.md,
          borderRadius: theme.radius.xl,
          backgroundColor: colors.surface,
          ...lift,
        }}
      >
        <View style={{ borderRadius: theme.radius.xl, overflow: 'hidden' }}>
          <AnimatedPressable
            variant="card"
            onPress={() => {
              void haptics.selection();
              onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={title}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: theme.radius.xl,
              overflow: 'hidden',
            }}
          >
            <View style={{ aspectRatio: 0.92, backgroundColor: colors.surfaceSecondary }}>
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: theme.spacing.sm,
                  }}
                >
                  <AppText variant="caption" color="muted" align="center">
                    {t('mobile.catalog.noImage')}
                  </AppText>
                </View>
              )}

              {orderedBefore ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    ...(isRTL ? { right: 8 } : { left: 8 }),
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: theme.radius.full,
                    backgroundColor: dark ? 'rgba(30,26,27,0.78)' : 'rgba(255,255,255,0.92)',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="medium"
                    style={{ color: colors.brand, fontSize: 10, lineHeight: 12 }}
                  >
                    {t('mobile.catalog.orderedBadge')}
                  </AppText>
                </View>
              ) : null}
            </View>

            <View
              style={{
                padding: theme.spacing.sm + 2,
                gap: 4,
                alignItems: isRTL ? 'flex-end' : 'flex-start',
              }}
            >
              {categoryLabel ? (
                <AppText
                  variant="caption"
                  numberOfLines={1}
                  style={{
                    color: colors.textMuted,
                    fontSize: 11,
                    lineHeight: 14,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {categoryLabel}
                </AppText>
              ) : null}
              <AppText
                variant="body"
                weight={titleWeight}
                numberOfLines={2}
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  color: colors.textPrimary,
                  minHeight: 40,
                  fontSize: 14,
                  lineHeight: 18,
                }}
              >
                {title}
              </AppText>
              {priceLabel ? (
                <AppText
                  variant="caption"
                  weight="semibold"
                  dir="ltr"
                  style={{
                    textAlign: isRTL ? 'right' : 'left',
                    color: colors.textPrimary,
                    fontSize: 14,
                    lineHeight: 18,
                  }}
                >
                  {priceLabel}
                </AppText>
              ) : null}
            </View>
          </AnimatedPressable>

          {onToggleFavorite ? (
            <Pressable
              onPress={() => {
                void haptics.selection();
                onToggleFavorite();
              }}
              accessibilityRole="button"
              accessibilityLabel={
                favorited
                  ? t('mobile.catalog.favoriteRemove')
                  : t('mobile.catalog.favoriteAdd')
              }
              hitSlop={8}
              style={{
                position: 'absolute',
                top: 8,
                ...(isRTL ? { left: 8 } : { right: 8 }),
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: dark ? 'rgba(30,26,27,0.72)' : 'rgba(255,255,255,0.92)',
                borderWidth: 1,
                borderColor: colors.border,
                zIndex: 2,
              }}
            >
              <Ionicons
                name={favorited ? 'heart' : 'heart-outline'}
                size={18}
                color={favorited ? colors.error : colors.brand}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </ListItemEnter>
  );
}
