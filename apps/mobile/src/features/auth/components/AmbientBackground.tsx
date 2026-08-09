import { useEffect } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/motion/useReducedMotion';
import type { LoginColors } from '../theme/loginColors';

type Props = {
  colors: LoginColors;
  canvasProgress?: SharedValue<number>;
  darkArtwork?: boolean;
};

/** Precomposed field: small M, tilted left, airy aligned grid (matches login screenshot). */
const fieldLight = require('../../../../assets/brand/watermark-field-on-light.png');
const fieldDark = require('../../../../assets/brand/watermark-field-on-dark.png');

const FIELD_W = 976;
const FIELD_H = 1248;

/**
 * Full-bleed watermark — two copies, seamless left → right.
 */
export function AmbientBackground({
  colors,
  canvasProgress,
  darkArtwork = false,
}: Props) {
  const reduce = useReducedMotion();
  const { width: winW, height: winH } = useWindowDimensions();
  const fallbackProgress = useSharedValue(1);
  const progress = canvasProgress ?? fallbackProgress;
  const drift = useSharedValue(0);

  // ~8 marks across; cover full height so top/bottom aren't empty
  const marksAcross = 8;
  const cellX = 61;
  const coverScale = Math.max((winW / marksAcross) / cellX, (winH * 1.02) / FIELD_H);
  const stripW = FIELD_W * coverScale;
  const stripH = FIELD_H * coverScale;

  useEffect(() => {
    if (reduce) {
      drift.value = 0;
      return;
    }
    drift.value = 0;
    drift.value = withRepeat(
      withTiming(1, { duration: 52000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [drift, reduce]);

  const fieldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.08, 1]),
  }));

  const rowStyle = useAnimatedStyle(() => ({
    transform: [
      {
        // Drift right → left
        translateX: reduce ? 0 : interpolate(drift.value, [0, 1], [0, -stripW]),
      },
    ],
  }));

  const source = darkArtwork ? fieldDark : fieldLight;
  // Subtle like the screenshot (low contrast watermark)
  const sheetOpacity = darkArtwork ? 0.36 : 0.3;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backgroundDeep }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: 0.97 }]} />
      <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, fieldStyle]}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: (winH - stripH) / 2,
              left: 0,
              flexDirection: 'row',
              width: stripW * 2,
              height: stripH,
            },
            rowStyle,
          ]}
        >
          <Image
            source={source}
            resizeMode="stretch"
            style={{ width: stripW, height: stripH, opacity: sheetOpacity }}
          />
          <Image
            source={source}
            resizeMode="stretch"
            style={{ width: stripW, height: stripH, opacity: sheetOpacity }}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
