import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { SkeletonShimmer, useReducedMotion } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type ProductCardMediaProps = {
  /** All product photos — auto-scrolls when more than one. */
  imageUrls?: string[];
  /** @deprecated Prefer imageUrls. */
  imageUrl?: string | null;
  width: number;
  aspectRatio?: number;
  galleryCount?: number;
};

const AUTO_MS = 3000;

/** Edge-to-edge media band — loops through gallery photos. */
export function ProductCardMedia({
  imageUrls,
  imageUrl,
  width,
  aspectRatio = 4 / 5,
  galleryCount = 0,
}: ProductCardMediaProps) {
  const { colors, theme } = useTheme();
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const uris =
    imageUrls && imageUrls.length
      ? imageUrls.filter(Boolean)
      : imageUrl
        ? [imageUrl]
        : [];
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const height = Math.round(width / aspectRatio);
  const multi = uris.length > 1;
  const safeIndex = uris.length ? index % uris.length : 0;
  const current = uris[safeIndex] ?? null;
  const uriKey = uris.join('|');

  useEffect(() => {
    setIndex(0);
  }, [uriKey]);

  useEffect(() => {
    if (!multi || reduce) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % uris.length);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [multi, reduce, uris.length, uriKey]);

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: colors.surfaceSecondary,
        overflow: 'hidden',
      }}
    >
      {current ? (
        <>
          {!loaded[current] ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <SkeletonShimmer height={height} />
            </View>
          ) : null}
          <Animated.View
            key={current}
            entering={reduce ? undefined : FadeIn.duration(420)}
            style={{ width, height }}
          >
            <Image
              source={{ uri: current }}
              style={{ width, height, opacity: loaded[current] ? 1 : 0 }}
              resizeMode="cover"
              onLoad={() => setLoaded((prev) => ({ ...prev, [current]: true }))}
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
          {uris.map((uri, i) =>
            i === safeIndex ? null : (
              <Image
                key={`preload-${uri}-${i}`}
                source={{ uri }}
                style={{ width: 1, height: 1, position: 'absolute', opacity: 0 }}
                onLoad={() => setLoaded((prev) => ({ ...prev, [uri]: true }))}
              />
            ),
          )}
        </>
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

      {multi ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: theme.spacing.sm,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          {uris.map((_, i) => {
            const active = i === safeIndex;
            return (
              <View
                key={`dot-${i}`}
                style={{
                  width: active ? 14 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: active ? '#fff' : 'rgba(255,255,255,0.45)',
                }}
              />
            );
          })}
        </View>
      ) : galleryCount > 1 ? (
        <View
          style={{
            position: 'absolute',
            bottom: theme.spacing.sm,
            right: theme.spacing.sm,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: theme.radius.full,
            backgroundColor: 'rgba(30,26,27,0.72)',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            dir="ltr"
            style={{ color: '#fff', fontSize: 11, lineHeight: 14 }}
          >
            {galleryCount}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
