import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { PRODUCT_PHOTO_ASPECT_RATIO } from '../productPhotoUpload';

type Props = {
  photos: string[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onRemoveAt: (index: number) => void;
  onAddPress: () => void;
  uploading?: boolean;
  aspectRatio?: number;
};

/**
 * Floor multi-photo board — hero preview, thumbnail rail, add / remove.
 * No URL paste; photos come from camera or library only.
 */
export function ProductGalleryBoard({
  photos,
  selectedIndex,
  onSelectIndex,
  onRemoveAt,
  onAddPress,
  uploading = false,
  aspectRatio = PRODUCT_PHOTO_ASPECT_RATIO,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const safeIndex = photos.length
    ? Math.min(Math.max(selectedIndex, 0), photos.length - 1)
    : 0;
  const current = photos[safeIndex] ?? null;

  const label = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const heroStyle = {
    width: '100%' as const,
    aspectRatio,
    borderRadius: theme.radius.xl,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...orderBoardShadow(colorScheme),
  };

  const heroInner = (
    <>
      {current ? (
        <Image
          source={{ uri: current }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            alignItems: 'center',
            gap: theme.spacing.sm,
            padding: theme.spacing.lg,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="images-outline" size={26} color={colors.brand} />
          </View>
          <AppText variant="label" weight="semibold" style={{ color: colors.brand }}>
            {label('catalog.productPhotosTapHint', 'Tap to add product photos')}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            align="center"
            style={{ lineHeight: 16 }}
          >
            {label(
              'catalog.productPhotosHint',
              'Add several photos — they rotate on product cards.',
            )}
          </AppText>
        </View>
      )}

      {photos.length > 1 && !uploading ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: theme.spacing.sm,
            ...(isRTL ? { left: theme.spacing.sm } : { right: theme.spacing.sm }),
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: theme.radius.full,
            backgroundColor: 'rgba(30,26,27,0.55)',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            dir="ltr"
            style={{ color: '#fff', fontSize: 11, lineHeight: 14 }}
          >
            {safeIndex + 1}/{photos.length}
          </AppText>
        </View>
      ) : null}

      {uploading ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(30,26,27,0.4)',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <ActivityIndicator color={colors.onBrand} />
          <AppText variant="caption" style={{ color: colors.onBrand }}>
            {t('common.uploading')}
          </AppText>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={{ gap: theme.spacing.md }}>
      {current ? (
        <View style={heroStyle}>{heroInner}</View>
      ) : (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={label('catalog.changeProductPhoto', 'Product photos')}
          disabled={uploading}
          onPress={() => {
            void haptics.selection();
            onAddPress();
          }}
          style={heroStyle}
        >
          {heroInner}
        </AnimatedPressable>
      )}

      {photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: theme.spacing.sm,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            // Room for the delete badge that sits on the thumb corner.
            paddingTop: 8,
            paddingBottom: 2,
            paddingHorizontal: 4,
          }}
        >
        {photos.map((uri, i) => {
          const active = i === safeIndex;
          return (
            <View
              key={`${uri}-${i}`}
              style={{
                position: 'relative',
                width: 72 + 8,
                height: 72 + 8,
                ...(isRTL ? { paddingLeft: 8 } : { paddingRight: 8 }),
              }}
            >
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label('catalog.productPhotoThumb', 'Photo')}
                onPress={() => {
                  void haptics.selection();
                  onSelectIndex(i);
                }}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: theme.radius.lg,
                  overflow: 'hidden',
                  borderWidth: 2,
                  borderColor: active ? colors.brand : colors.borderStrong,
                  backgroundColor: colors.surfaceSecondary,
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </AnimatedPressable>
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('catalog.removeProductPhoto')}
                hitSlop={6}
                onPress={() => {
                  void haptics.selection();
                  onRemoveAt(i);
                }}
                style={{
                  position: 'absolute',
                  top: -2,
                  ...(isRTL ? { left: -2 } : { right: -2 }),
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.error,
                  zIndex: 2,
                }}
              >
                <Ionicons name="close" size={14} color={colors.error} />
              </AnimatedPressable>
            </View>
          );
        })}

        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={label('catalog.addProductPhotos', 'Add photos')}
          disabled={uploading}
          onPress={() => {
            void haptics.selection();
            onAddPress();
          }}
          style={{
            width: 72,
            height: 72,
            marginTop: 0,
            borderRadius: theme.radius.lg,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.brand,
            backgroundColor: colors.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <Ionicons name="add" size={22} color={colors.brand} />
          <AppText variant="caption" weight={titleWeight} color="brand" style={{ fontSize: 10 }}>
            {label('catalog.addProductPhotos', 'Add')}
          </AppText>
        </AnimatedPressable>
        </ScrollView>
      ) : null}
    </View>
  );
}
