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
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type ImageCarouselProps = {
  uris: string[];
  height?: number;
  /** Defaults to screen width — pass measured width when nested in padded layouts. */
  itemWidth?: number;
};

export function ImageCarousel({ uris, height = 240, itemWidth }: ImageCarouselProps) {
  const { colors, theme } = useTheme();
  const { t } = useLocale();
  const [index, setIndex] = useState(0);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const listRef = useRef<FlatList<string>>(null);
  const pageW = itemWidth && itemWidth > 0 ? itemWidth : SCREEN_W;
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  if (!uris.length) {
    return (
      <View
        style={{
          height,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText variant="caption" color="muted">
          {t('mobile.orderDetail.noImage')}
        </AppText>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        ref={listRef}
        data={uris}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(uri, i) => `${uri}-${i}`}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 60 }}
        getItemLayout={(_, i) => ({
          length: pageW,
          offset: pageW * i,
          index: i,
        })}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setViewerUri(item)}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('mobile.orderDetail.openImage')}
          >
            <Image
              source={{ uri: item }}
              style={{ width: pageW, height }}
              resizeMode="cover"
            />
          </Pressable>
        )}
      />
      {uris.length > 1 ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: theme.spacing.xs,
            paddingVertical: theme.spacing.sm,
          }}
        >
          {uris.map((uri, i) => (
            <View
              key={`${uri}-dot-${i}`}
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === index ? colors.brand : colors.border,
              }}
            />
          ))}
        </View>
      ) : null}
      <ZoomViewer uri={viewerUri} onClose={() => setViewerUri(null)} />
    </View>
  );
}

function ZoomViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);

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
    <Modal visible={Boolean(uri)} animationType="fade" onRequestClose={onClose} transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' }}>
        <Pressable
          onPress={onClose}
          style={{
            position: 'absolute',
            top: theme.spacing['3xl'],
            right: theme.spacing.lg,
            zIndex: 2,
            padding: theme.spacing.sm,
          }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.orderDetail.closeImage')}
        >
          <AppText variant="label" weight="semibold" style={{ color: '#fff' }}>
            {t('mobile.orderDetail.closeImage')}
          </AppText>
        </Pressable>
        {uri ? (
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
                  style={{ width: SCREEN_W, height: SCREEN_H * 0.7 }}
                  resizeMode="contain"
                />
              </Animated.View>
            </GestureDetector>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}
