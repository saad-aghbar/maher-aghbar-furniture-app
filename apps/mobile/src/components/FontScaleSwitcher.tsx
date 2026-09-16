import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics, springs, useReducedMotion } from '@/motion';
import {
  FONT_SCALE_DEFAULT,
  FONT_SCALE_DEFAULT_SNAP_IN,
  applyDefaultSnap,
  fontScaleToProgress,
  progressToFontScale,
  useFontScale,
  useTheme,
} from '@/theme';

const CIRCLE = 40;
const PAD = 8;
const A_SLOT = 22;
const TRACK_W = 120;
const THUMB = 22;
const EXPANDED_W = PAD * 2 + A_SLOT * 2 + TRACK_W;

type Props = {
  expandToward?: 'start' | 'end';
};

/**
 * 40px circle (−A+) that expands into a live text-size slider.
 * Physical left = smaller, right = bigger in every locale.
 */
export function FontScaleSwitcher({ expandToward = 'end' }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { fontScale, setFontScale } = useFontScale();
  const reduce = useReducedMotion();
  const openSv = useSharedValue(0);
  const progress = useSharedValue(fontScaleToProgress(fontScale));
  const dragging = useSharedValue(0);
  const latched = useSharedValue(
    Math.abs(fontScaleToProgress(fontScale) - 0.5) <= FONT_SCALE_DEFAULT_SNAP_IN ? 1 : 0,
  );
  const [expanded, setExpanded] = useState(false);
  const draggingRef = useRef(false);

  const preview = useCallback(
    (next: number) => {
      setFontScale(next, false);
    },
    [setFontScale],
  );

  const commit = useCallback(
    (next: number) => {
      setFontScale(next, true);
    },
    [setFontScale],
  );

  const previewRef = useRef(preview);
  const commitRef = useRef(commit);
  previewRef.current = preview;
  commitRef.current = commit;

  const previewJS = useCallback((next: number) => {
    previewRef.current(next);
  }, []);

  const commitJS = useCallback((next: number) => {
    commitRef.current(next);
  }, []);

  const tickDefault = useCallback(() => {
    void haptics.confirmLight();
  }, []);

  const markDragging = useCallback((next: boolean) => {
    draggingRef.current = next;
  }, []);

  const reduceSv = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    reduceSv.value = reduce ? 1 : 0;
  }, [reduce, reduceSv]);

  useEffect(() => {
    if (draggingRef.current) return;
    const p = fontScaleToProgress(fontScale);
    progress.value = p;
    latched.value = Math.abs(p - 0.5) <= FONT_SCALE_DEFAULT_SNAP_IN ? 1 : 0;
  }, [fontScale, latched, progress]);

  const setOpen = (next: boolean) => {
    setExpanded(next);
    if (reduce) {
      openSv.value = next ? 1 : 0;
    } else {
      openSv.value = next ? withSpring(1, springs.snappy) : withTiming(0, { duration: 200 });
    }
  };

  const toggle = () => {
    void haptics.selection();
    setOpen(!expanded);
  };

  const trackGesture = useMemo(() => {
    const applyFromX = (x: number, persist: boolean) => {
      'worklet';
      const usable = TRACK_W - THUMB;
      const raw = Math.min(1, Math.max(0, (x - THUMB / 2) / usable));
      const snap = applyDefaultSnap(raw, latched.value);
      progress.value = snap.progress;
      latched.value = snap.latched;
      if (snap.snappedIn) {
        runOnJS(tickDefault)();
      }
      const scale = progressToFontScale(snap.progress);
      if (persist) {
        runOnJS(commitJS)(scale);
      } else {
        runOnJS(previewJS)(scale);
      }
    };

    const finishDrag = () => {
      'worklet';
      dragging.value = 0;
      if (latched.value) {
        progress.value = reduceSv.value ? 0.5 : withSpring(0.5, springs.snappy);
        runOnJS(commitJS)(FONT_SCALE_DEFAULT);
        return;
      }
      const snap = applyDefaultSnap(progress.value, 0);
      if (snap.latched) {
        progress.value = reduceSv.value ? 0.5 : withSpring(0.5, springs.snappy);
        latched.value = 1;
        runOnJS(tickDefault)();
        runOnJS(commitJS)(FONT_SCALE_DEFAULT);
        return;
      }
      runOnJS(commitJS)(progressToFontScale(progress.value));
    };

    const pan = Gesture.Pan()
      .minDistance(0)
      .activeOffsetX([-4, 4])
      .failOffsetY([-18, 18])
      .onBegin((e) => {
        dragging.value = 1;
        runOnJS(markDragging)(true);
        applyFromX(e.x, false);
      })
      .onChange((e) => {
        applyFromX(e.x, false);
      })
      .onEnd(() => {
        runOnJS(markDragging)(false);
        finishDrag();
      })
      .onFinalize(() => {
        dragging.value = 0;
        runOnJS(markDragging)(false);
      });

    const tapTrack = Gesture.Tap().onEnd((e) => {
      applyFromX(e.x, true);
    });

    return Gesture.Exclusive(pan, tapTrack);
  }, [commitJS, dragging, latched, markDragging, previewJS, progress, reduceSv, tickDefault]);

  const shellStyle = useAnimatedStyle(() => ({
    width: interpolate(openSv.value, [0, 1], [CIRCLE, EXPANDED_W]),
    borderRadius: CIRCLE / 2,
  }));

  const collapsedLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openSv.value, [0, 0.4], [1, 0]),
  }));

  const expandedRowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openSv.value, [0.35, 1], [0, 1]),
  }));

  const thumbStyle = useAnimatedStyle(() => {
    const usable = TRACK_W - THUMB;
    return {
      transform: [{ translateX: progress.value * usable }],
    };
  });

  const detentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(latched.value, [0, 1], [0.55, 1]),
    height: interpolate(latched.value, [0, 1], [10, 16]),
    top: interpolate(latched.value, [0, 1], [(CIRCLE - 10) / 2, (CIRCLE - 16) / 2]),
    backgroundColor: interpolateColor(
      latched.value,
      [0, 1],
      [colors.brandSoft, colors.brand],
    ),
  }));

  const alignSelf =
    expandToward === 'end'
      ? isRTL
        ? ('flex-start' as const)
        : ('flex-end' as const)
      : isRTL
        ? ('flex-end' as const)
        : ('flex-start' as const);

  const track = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: PAD,
        height: CIRCLE,
        width: EXPANDED_W,
        gap: 2,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('mobile.fontScale.smaller')}
        onPress={() => {
          void haptics.selection();
          progress.value = withTiming(0, { duration: reduce ? 0 : 140 });
          latched.value = 0;
          commit(progressToFontScale(0));
        }}
        style={{ width: A_SLOT, alignItems: 'center', justifyContent: 'center' }}
      >
        <AppText
          variant="caption"
          weight="medium"
          align="center"
          dir="ltr"
          style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 14 }}
        >
          A
        </AppText>
      </Pressable>

      <GestureDetector gesture={trackGesture}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={t('mobile.fontScale.a11y')}
          accessibilityValue={{
            min: 85,
            max: 140,
            now: Math.round(fontScale * 100),
            text: t('mobile.fontScale.default'),
          }}
          style={{
            width: TRACK_W,
            height: CIRCLE,
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
            }}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: TRACK_W / 2 - 1.5,
                width: 3,
                borderRadius: 1.5,
              },
              detentStyle,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: (CIRCLE - THUMB) / 2,
                width: THUMB,
                height: THUMB,
                borderRadius: THUMB / 2,
                backgroundColor: colors.brand,
                ...theme.elevation.raised,
              },
              thumbStyle,
            ]}
          />
        </View>
      </GestureDetector>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('mobile.fontScale.larger')}
        onPress={() => {
          void haptics.selection();
          progress.value = withTiming(1, { duration: reduce ? 0 : 140 });
          latched.value = 0;
          commit(progressToFontScale(1));
        }}
        style={{ width: A_SLOT, alignItems: 'center', justifyContent: 'center' }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          align="center"
          dir="ltr"
          style={{ color: colors.brand, fontSize: 17, lineHeight: 20 }}
        >
          A
        </AppText>
      </Pressable>
    </View>
  );

  const circleFace = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('mobile.fontScale.a11y')}
      accessibilityState={{ expanded }}
      hitSlop={6}
      onPress={toggle}
      style={{
        width: CIRCLE,
        height: CIRCLE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={collapsedLabelStyle}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <AppText
            variant="caption"
            weight="medium"
            align="center"
            dir="ltr"
            style={{ color: colors.brand, fontSize: 11, lineHeight: 14 }}
          >
            -
          </AppText>
          <AppText
            variant="caption"
            weight="semibold"
            align="center"
            dir="ltr"
            style={{ color: colors.brand, fontSize: 13, lineHeight: 16 }}
          >
            A
          </AppText>
          <AppText
            variant="caption"
            weight="medium"
            align="center"
            dir="ltr"
            style={{ color: colors.brand, fontSize: 11, lineHeight: 14 }}
          >
            +
          </AppText>
        </View>
      </Animated.View>
    </Pressable>
  );

  const catcher = expanded ? (
    <Pressable
      accessibilityLabel={t('common.close')}
      onPress={() => setOpen(false)}
      style={{
        position: 'absolute',
        width: 4000,
        height: 4000,
        top: -2000,
        left: -2000,
        zIndex: -1,
      }}
    />
  ) : null;

  return (
    <Animated.View entering={reduce ? undefined : FadeIn.duration(280).delay(40)} style={{ alignSelf, zIndex: 40 }}>
      <Animated.View
        style={[
          {
            height: CIRCLE,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            ...theme.elevation.raised,
          },
          shellStyle,
        ]}
      >
        {!expanded ? (
          circleFace
        ) : (
          <Animated.View style={expandedRowStyle}>{track}</Animated.View>
        )}
      </Animated.View>
      {catcher}
    </Animated.View>
  );
}
