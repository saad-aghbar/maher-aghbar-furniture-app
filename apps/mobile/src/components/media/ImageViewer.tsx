import { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { durations, haptics, useReducedMotion } from '@/motion';
import { brandColors, useTheme } from '@/theme';

const BACKDROP = brandColors.backgroundDark;
const IVORY = brandColors.foregroundOnDark;
const INK = brandColors.foreground;
const GOLD = brandColors.primary;
const MAX_ZOOM = 4;
const THUMB = 64;
const PHOTO_INSET = 16;
const PAGE_MS = durations.screen;
const pageEasing = Easing.out(Easing.cubic);

export type ImageViewerProps = {
  open: boolean;
  uris: string[];
  index: number;
  onIndexChange?: (index: number) => void;
  onClose: () => void;
  title?: string;
};

function fitContain(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number,
): { width: number; height: number } | null {
  if (naturalW <= 0 || naturalH <= 0 || boxW <= 0 || boxH <= 0) return null;
  const scale = Math.min(boxW / naturalW, boxH / naturalH);
  return {
    width: Math.max(1, Math.round(naturalW * scale)),
    height: Math.max(1, Math.round(naturalH * scale)),
  };
}

function clampOffset(
  x: number,
  y: number,
  s: number,
  photoW: number,
  photoH: number,
  boxW: number,
  boxH: number,
) {
  'worklet';
  const maxX = Math.max(0, (photoW * s - boxW) / 2);
  const maxY = Math.max(0, (photoH * s - boxH) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
}

function PhotoFrame({
  uri,
  boxW,
  boxH,
  natural,
  radius,
}: {
  uri: string;
  boxW: number;
  boxH: number;
  natural?: { w: number; h: number };
  radius: number;
}) {
  const fitted = fitContain(natural?.w ?? 0, natural?.h ?? 0, boxW, boxH);
  return (
    <View style={styles.photoCenter}>
      <View
        style={[
          fitted ? photoShadow : null,
          fitted
            ? { width: fitted.width, height: fitted.height, borderRadius: radius }
            : styles.photoFallback,
        ]}
      >
        <View
          style={{
            overflow: 'hidden',
            borderRadius: fitted ? radius : 0,
            borderWidth: fitted ? StyleSheet.hairlineWidth * 2 : 0,
            borderColor: 'rgba(245,241,234,0.16)',
            width: fitted?.width ?? '100%',
            height: fitted?.height ?? '100%',
          }}
        >
          <Image
            source={{ uri }}
            style={{
              width: fitted?.width ?? '100%',
              height: fitted?.height ?? '100%',
            }}
            resizeMode={fitted ? 'cover' : 'contain'}
            accessibilityIgnoresInvertColors
            accessibilityRole="image"
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Full-screen photo viewer — contain-fit, circular close, fade only.
 * Used everywhere a thumbnail opens a larger preview.
 */
export function ImageViewer({
  open,
  uris,
  index,
  onIndexChange,
  onClose,
  title,
}: ImageViewerProps) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pagerX = useSharedValue(0);
  const pagerStartX = useSharedValue(0);
  const indexSV = useSharedValue(0);
  const lastSV = useSharedValue(0);
  const manySV = useSharedValue(0);
  const pageW = useSharedValue(0);
  const stageW = useSharedValue(0);
  const stageH = useSharedValue(0);
  const photoW = useSharedValue(0);
  const photoH = useSharedValue(0);
  const skipPagerSync = useSharedValue(0);
  const reduceSV = useSharedValue(0);
  const [pageSize, setPageSize] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState<Record<string, { w: number; h: number }>>({});

  const last = Math.max(uris.length - 1, 0);
  const safeIndex = Math.min(Math.max(index, 0), last);
  const visible = open && uris.length > 0;
  const many = uris.length > 1;
  const innerW = Math.max(0, pageSize.w - PHOTO_INSET * 2);
  const innerH = Math.max(0, pageSize.h - PHOTO_INSET * 2);
  const currentUri = uris[safeIndex] ?? null;
  const currentFitted = currentUri
    ? fitContain(natural[currentUri]?.w ?? 0, natural[currentUri]?.h ?? 0, innerW, innerH)
    : null;

  const resetZoom = () => {
    scale.value = 1;
    saved.value = 1;
    tx.value = 0;
    ty.value = 0;
  };

  const settlePager = (nextIndex: number, animate: boolean) => {
    'worklet';
    const w = pageW.value;
    const target = w > 0 ? -nextIndex * w : 0;
    if (!animate || reduceSV.value === 1) {
      pagerX.value = target;
      return;
    }
    pagerX.value = withTiming(target, { duration: PAGE_MS, easing: pageEasing });
  };

  useEffect(() => {
    reduceSV.value = reduce ? 1 : 0;
  }, [reduce, reduceSV]);

  useEffect(() => {
    indexSV.value = safeIndex;
    lastSV.value = last;
    manySV.value = many ? 1 : 0;
    resetZoom();
    if (skipPagerSync.value === 1) {
      skipPagerSync.value = 0;
      return;
    }
    const w = pageW.value;
    if (w <= 0) return;
    const target = -safeIndex * w;
    if (Math.abs(pagerX.value - target) < 2) {
      pagerX.value = target;
      return;
    }
    pagerX.value = reduce
      ? target
      : withTiming(target, { duration: PAGE_MS, easing: pageEasing });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pager follows the controlled index
  }, [safeIndex, last, many, visible, reduce]);

  useEffect(() => {
    stageW.value = innerW;
    stageH.value = innerH;
    photoW.value = currentFitted?.width ?? innerW;
    photoH.value = currentFitted?.height ?? innerH;
  }, [innerW, innerH, currentFitted, stageW, stageH, photoW, photoH]);

  const urisKey = uris.join('\0');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const list = urisKey ? urisKey.split('\0') : [];
    for (const next of list) {
      Image.getSize(
        next,
        (w, h) => {
          if (cancelled) return;
          setNatural((prev) => (prev[next] ? prev : { ...prev, [next]: { w, h } }));
        },
        () => undefined,
      );
    }
    return () => {
      cancelled = true;
    };
  }, [visible, urisKey]);

  const close = () => {
    resetZoom();
    void haptics.selection();
    onClose();
  };

  const commitIndex = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), last);
    if (clamped === safeIndex) return;
    void haptics.selection();
    onIndexChange?.(clamped);
  };

  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), last);
    if (clamped === safeIndex) return;
    void haptics.selection();
    resetZoom();
    skipPagerSync.value = 1;
    const w = pageW.value;
    if (w > 0) {
      const target = -clamped * w;
      pagerX.value = reduce
        ? target
        : withTiming(target, { duration: PAGE_MS, easing: pageEasing });
    }
    onIndexChange?.(clamped);
  };

  const pinch = Gesture.Pinch()
    .enabled(!reduce)
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(1, saved.value * e.scale));
      const clamped = clampOffset(
        tx.value,
        ty.value,
        scale.value,
        photoW.value,
        photoH.value,
        stageW.value,
        stageH.value,
      );
      tx.value = clamped.x;
      ty.value = clamped.y;
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withTiming(1, { duration: durations.cardEnter });
        saved.value = 1;
        tx.value = withTiming(0, { duration: durations.cardEnter });
        ty.value = withTiming(0, { duration: durations.cardEnter });
        return;
      }
      saved.value = scale.value;
      const clamped = clampOffset(
        tx.value,
        ty.value,
        scale.value,
        photoW.value,
        photoH.value,
        stageW.value,
        stageH.value,
      );
      tx.value = withTiming(clamped.x, { duration: durations.micro });
      ty.value = withTiming(clamped.y, { duration: durations.micro });
    });

  const pan = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      panStartX.value = tx.value;
      panStartY.value = ty.value;
      pagerStartX.value = pagerX.value;
    })
    .onUpdate((e) => {
      if (scale.value > 1.05) {
        const clamped = clampOffset(
          panStartX.value + e.translationX,
          panStartY.value + e.translationY,
          scale.value,
          photoW.value,
          photoH.value,
          stageW.value,
          stageH.value,
        );
        tx.value = clamped.x;
        ty.value = clamped.y;
        return;
      }
      if (manySV.value === 0 || pageW.value <= 0) return;
      const min = -lastSV.value * pageW.value;
      const max = 0;
      let next = pagerStartX.value + e.translationX;
      if (next > max) next = max + (next - max) * 0.22;
      if (next < min) next = min + (next - min) * 0.22;
      pagerX.value = next;
    })
    .onEnd((e) => {
      if (scale.value > 1.05) {
        const clamped = clampOffset(
          tx.value,
          ty.value,
          scale.value,
          photoW.value,
          photoH.value,
          stageW.value,
          stageH.value,
        );
        tx.value = withTiming(clamped.x, { duration: durations.micro });
        ty.value = withTiming(clamped.y, { duration: durations.micro });
        return;
      }
      if (manySV.value === 0 || pageW.value <= 0) {
        settlePager(indexSV.value, true);
        return;
      }
      const w = pageW.value;
      const projected = pagerX.value + e.velocityX * 0.18;
      let next = Math.round(-projected / w);
      if (e.velocityX < -520) next = indexSV.value + 1;
      else if (e.velocityX > 520) next = indexSV.value - 1;
      next = Math.min(lastSV.value, Math.max(0, next));
      scale.value = 1;
      saved.value = 1;
      tx.value = 0;
      ty.value = 0;
      skipPagerSync.value = 1;
      settlePager(next, true);
      if (next !== indexSV.value) {
        runOnJS(commitIndex)(next);
      }
    });

  const tap = Gesture.Tap()
    .maxDistance(12)
    .onEnd((_e, success) => {
      if (!success) return;
      if (scale.value > 1.05) {
        scale.value = withTiming(1, { duration: durations.cardEnter });
        saved.value = 1;
        tx.value = withTiming(0, { duration: durations.cardEnter });
        ty.value = withTiming(0, { duration: durations.cardEnter });
        return;
      }
      runOnJS(close)();
    });

  const composed = Gesture.Exclusive(Gesture.Simultaneous(pinch, pan), tap);
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  const pagerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pagerX.value }],
  }));

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    const first = pageW.value <= 0;
    pageW.value = width;
    setPageSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
    if (first) {
      pagerX.value = -safeIndex * width;
    }
  };

  const touch = theme.sizes.touch.min;
  const photoRadius = theme.radius.xl;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduce ? 'none' : 'fade'}
      onRequestClose={close}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <GestureHandlerRootView style={styles.root}>
        <View accessibilityViewIsModal style={[styles.root, { backgroundColor: BACKDROP }]}>
          <View
            style={{
              paddingTop: Math.max(insets.top, theme.spacing.sm) + 6,
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.sm,
              borderBottomWidth: many ? 0 : StyleSheet.hairlineWidth,
              borderBottomColor: 'rgba(245,241,234,0.10)',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              {many ? (
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: theme.radius.full,
                    backgroundColor: 'rgba(245,241,234,0.12)',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: 'rgba(245,241,234,0.22)',
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    dir="ltr"
                    style={{ color: IVORY, fontSize: 12, lineHeight: 16 }}
                  >
                    {safeIndex + 1} / {uris.length}
                  </AppText>
                </View>
              ) : (
                <View style={{ width: touch }} />
              )}

              <View style={{ flex: 1, minWidth: 0 }}>
                {title ? (
                  <AppText
                    variant="caption"
                    weight="medium"
                    numberOfLines={1}
                    style={{
                      color: 'rgba(245,241,234,0.88)',
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {title}
                  </AppText>
                ) : null}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={8}
                onPress={close}
                style={{
                  width: touch,
                  height: touch,
                  borderRadius: touch / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: IVORY,
                  ...photoShadow,
                }}
              >
                <Ionicons name="close" size={22} color={INK} />
              </Pressable>
            </View>
          </View>

          {many ? (
            <View
              style={{
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: 'rgba(245,241,234,0.12)',
                backgroundColor: 'rgba(245,241,234,0.05)',
              }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  gap: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '100%',
                }}
              >
                {uris.map((thumb, i) => {
                  const active = i === safeIndex;
                  return (
                    <Pressable
                      key={`${thumb}-thumb-${i}`}
                      onPress={() => goTo(i)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={{
                        width: THUMB,
                        height: THUMB,
                        borderRadius: theme.radius.md,
                        overflow: 'hidden',
                        borderWidth: active ? 2 : StyleSheet.hairlineWidth * 2,
                        borderColor: active ? GOLD : 'rgba(245,241,234,0.22)',
                        opacity: active ? 1 : 0.48,
                        backgroundColor: 'rgba(245,241,234,0.08)',
                      }}
                    >
                      <Image
                        source={{ uri: thumb }}
                        style={{ width: THUMB, height: THUMB }}
                        resizeMode="cover"
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.stage} onLayout={onStageLayout}>
            <GestureDetector gesture={composed}>
              <Animated.View
                style={[
                  styles.pager,
                  pageSize.w > 0
                    ? { width: pageSize.w * Math.max(uris.length, 1), height: pageSize.h }
                    : styles.stageFill,
                  pagerStyle,
                ]}
              >
                {(pageSize.w > 0 ? uris : currentUri ? [currentUri] : []).map((item, i) => {
                  const pageIndex = pageSize.w > 0 ? i : safeIndex;
                  const active = pageIndex === safeIndex;
                  return (
                    <View
                      key={`${item}-page-${pageIndex}`}
                      style={{
                        width: pageSize.w || '100%',
                        height: pageSize.h || '100%',
                        padding: PHOTO_INSET,
                      }}
                    >
                      <Animated.View style={[styles.stageFill, active ? zoomStyle : null]}>
                        <PhotoFrame
                          uri={item}
                          boxW={innerW}
                          boxH={innerH}
                          natural={natural[item]}
                          radius={photoRadius}
                        />
                      </Animated.View>
                    </View>
                  );
                })}
              </Animated.View>
            </GestureDetector>
          </View>

          <View style={{ height: Math.max(insets.bottom, theme.spacing.md) }} />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const photoShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
  },
  default: {
    elevation: 10,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  stage: {
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  pager: {
    flexDirection: 'row',
  },
  stageFill: {
    flex: 1,
  },
  photoCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFallback: {
    width: '100%',
    height: '100%',
  },
});
