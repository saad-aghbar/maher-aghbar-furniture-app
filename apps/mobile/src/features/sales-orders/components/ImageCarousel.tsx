import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  View,
  type ViewToken,
} from 'react-native';
import { AppText } from '@/components/AppText';
import { ImageViewer } from '@/components/media/ImageViewer';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

const { width: SCREEN_W } = Dimensions.get('window');

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
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
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
        onScrollToIndexFailed={() => undefined}
        getItemLayout={(_, i) => ({
          length: pageW,
          offset: pageW * i,
          index: i,
        })}
        renderItem={({ item, index: itemIndex }) => (
          <Pressable
            onPress={() => {
              void haptics.selection();
              setViewerIndex(itemIndex);
            }}
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
      <ImageViewer
        open={viewerIndex != null}
        uris={uris}
        index={viewerIndex ?? 0}
        onIndexChange={(i) => {
          setViewerIndex(i);
          setIndex(i);
          listRef.current?.scrollToIndex({ index: i, animated: false });
        }}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}
