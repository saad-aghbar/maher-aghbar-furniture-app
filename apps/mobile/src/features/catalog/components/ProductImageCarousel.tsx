import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  View,
  type ViewToken,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { SkeletonShimmer, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type ProductImageCarouselProps = {
  uris: string[];
  aspectRatio?: number;
  /** Overlay back control on the hero (PDP). */
  onBack?: () => void;
};

export function ProductImageCarousel({
  uris,
  aspectRatio = 1,
  onBack,
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
      <View style={{ width: SCREEN_W, height, backgroundColor: colors.surfaceSecondary }}>
        {empty ? (
          <Animated.View
            entering={FadeIn.duration(280)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppText variant="body" color="muted">
              {t('mobile.productDetail.noImage')}
            </AppText>
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
            paddingBottom: theme.spacing.xs,
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

      <ZoomViewer
        open={viewerOpen}
        uris={uris}
        index={index}
        onIndexChange={setIndex}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}

function ZoomViewer({
  open,
  uris,
  index,
  onIndexChange,
  onClose,
}: {
  open: boolean;
  uris: string[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const { colors, theme } = useTheme();
  const { t, isRTL } = useLocale();
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const uri = uris[index] ?? null;

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(4, Math.max(1, saved.value * e.scale));
    })
    .onEnd(() => {
      saved.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withTiming(1);
        saved.value = 1;
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose} transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(30,26,27,0.96)' }}>
        <View
          style={{
            position: 'absolute',
            top: Math.max(insets.top, theme.spacing.lg),
            left: theme.spacing.lg,
            right: theme.spacing.lg,
            zIndex: 2,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {uris.length > 1 ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
                backgroundColor: 'rgba(255,255,255,0.12)',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                dir="ltr"
                style={{ color: '#fff', fontSize: 11 }}
              >
                {index + 1}/{uris.length}
              </AppText>
            </View>
          ) : (
            <View />
          )}
          <Pressable
            onPress={() => {
              void haptics.selection();
              onClose();
            }}
            style={{
              minHeight: 40,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.xl,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.productDetail.closeImage')}
          >
            <AppText variant="label" weight="semibold">
              {t('mobile.productDetail.closeImage')}
            </AppText>
          </Pressable>
        </View>

        {uri ? (
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              bouncesZoom
            >
              <GestureDetector gesture={pinch}>
                <Animated.View style={style}>
                  <Image
                    source={{ uri }}
                    style={{ width: SCREEN_W, height: SCREEN_H * 0.62 }}
                    resizeMode="contain"
                  />
                </Animated.View>
              </GestureDetector>
            </ScrollView>
          </Animated.View>
        ) : null}

        {uris.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
              flexDirection: isRTL ? 'row-reverse' : 'row',
            }}
          >
            {uris.map((thumb, i) => {
              const active = i === index;
              return (
                <Pressable
                  key={`${thumb}-z-${i}`}
                  onPress={() => {
                    void haptics.selection();
                    scale.value = 1;
                    saved.value = 1;
                    onIndexChange(i);
                  }}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: theme.radius.lg,
                    overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: active ? colors.brand : 'rgba(255,255,255,0.25)',
                  }}
                >
                  <Image source={{ uri: thumb }} style={{ width: 56, height: 56 }} resizeMode="cover" />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}
