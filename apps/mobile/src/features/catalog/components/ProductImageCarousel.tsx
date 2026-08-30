import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  View,
  type ViewToken,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { EmptyProductImage } from '@/components/media/EmptyProductImage';
import { ImageViewer } from '@/components/media/ImageViewer';
import { SkeletonShimmer, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

const { width: SCREEN_W } = Dimensions.get('window');

type ProductImageCarouselProps = {
  uris: string[];
  aspectRatio?: number;
  /** Overlay back control on the hero (PDP). */
  onBack?: () => void;
  /** Optional favorite toggle opposite the back control. */
  favorited?: boolean;
  onToggleFavorite?: () => void;
};

export function ProductImageCarousel({
  uris,
  aspectRatio = 1,
  onBack,
  favorited = false,
  onToggleFavorite,
}: ProductImageCarouselProps) {
  const { colors, theme } = useTheme();
  const { t, isRTL } = useLocale();
  const insets = useSafeAreaInsets();
  const height = Math.round(SCREEN_W / aspectRatio);
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const listRef = useRef<FlatList<string>>(null);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  const goTo = (i: number) => {
    void haptics.selection();
    setIndex(i);
    listRef.current?.scrollToIndex({ index: i, animated: true });
  };

  const empty = !uris.length;

  return (
    <View>
      <View
        style={{
          width: SCREEN_W,
          height,
          backgroundColor: empty ? colors.background : colors.surfaceSecondary,
        }}
      >
        {empty ? (
          <Animated.View entering={FadeIn.duration(280)} style={{ flex: 1 }}>
            <EmptyProductImage caption={t('mobile.productDetail.noImage')} />
          </Animated.View>
        ) : (
          <FlatList
            ref={listRef}
            data={uris}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(uri, i) => `${uri}-${i}`}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={{ viewAreaCoveragePercentThreshold: 60 }}
            onScrollToIndexFailed={() => undefined}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  void haptics.selection();
                  setViewerOpen(true);
                }}
                accessibilityRole="imagebutton"
                accessibilityLabel={t('mobile.productDetail.openImage')}
              >
                <View style={{ width: SCREEN_W, height, backgroundColor: colors.surfaceSecondary }}>
                  {!loaded[item] ? (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                      <SkeletonShimmer height={height} />
                    </View>
                  ) : null}
                  <Image
                    source={{ uri: item }}
                    style={{
                      width: SCREEN_W,
                      height,
                      opacity: loaded[item] ? 1 : 0,
                    }}
                    resizeMode="cover"
                    onLoad={() => setLoaded((prev) => ({ ...prev, [item]: true }))}
                  />
                </View>
              </Pressable>
            )}
          />
        )}

        {onBack ? (
          <Pressable
            onPress={() => {
              void haptics.selection();
              onBack();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.productDetail.back')}
            style={{
              position: 'absolute',
              top: Math.max(insets.top, theme.spacing.sm),
              ...(isRTL ? { right: theme.spacing.lg } : { left: theme.spacing.lg }),
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={isRTL ? 'chevron-forward' : 'chevron-back'}
              size={22}
              color={colors.textPrimary}
            />
          </Pressable>
        ) : null}

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
            style={{
              position: 'absolute',
              top: Math.max(insets.top, theme.spacing.sm),
              ...(isRTL ? { left: theme.spacing.lg } : { right: theme.spacing.lg }),
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={favorited ? 'heart' : 'heart-outline'}
              size={20}
              color={favorited ? colors.error : colors.brand}
            />
          </Pressable>
        ) : null}

        {uris.length > 1 ? (
          <View
            style={{
              position: 'absolute',
              top: Math.max(insets.top, theme.spacing.sm) + 6,
              alignSelf: 'center',
              left: 0,
              right: 0,
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <View
              style={{
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
                {index + 1}/{uris.length}
              </AppText>
            </View>
          </View>
        ) : null}
      </View>

      {uris.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            // Room for ProductDetailScreen sheet overlap (negative marginTop).
            paddingBottom: theme.spacing.lg + theme.spacing.sm,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}
        >
          {uris.map((uri, i) => {
            const active = i === index;
            return (
              <Pressable
                key={`${uri}-thumb-${i}`}
                onPress={() => goTo(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: theme.radius.lg,
                  overflow: 'hidden',
                  borderWidth: 2,
                  borderColor: active ? colors.brand : colors.border,
                  backgroundColor: colors.surfaceSecondary,
                }}
              >
                <Image source={{ uri }} style={{ width: 56, height: 56 }} resizeMode="cover" />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ImageViewer
        open={viewerOpen}
        uris={uris}
        index={index}
        onIndexChange={(i) => {
          setIndex(i);
          listRef.current?.scrollToIndex({ index: i, animated: false });
        }}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}
