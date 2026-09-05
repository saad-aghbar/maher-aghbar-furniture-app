import { useEffect } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
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
import { watermarkDriftX } from './watermarkDrift';

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
const DRIFT_MS = 52000;

/**
 * Full-bleed watermark — three copies, LTR layout, seamless loop.
 * Must stay LTR: RTL row-reverse + flipped translateX slides the field off-screen,
 * then withRepeat snaps it back (Ms disappear and pop in).
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
    cancelAnimation(drift);
    if (reduce) {
      drift.value = 0;
      return;
    }
    drift.value = 0;
    drift.value = withRepeat(
      withTiming(1, { duration: DRIFT_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(drift);
    };
  }, [drift, reduce]);

  const fieldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.08, 1]),
  }));

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: reduce ? 0 : watermarkDriftX(drift.value, stripW) }],
  }));

  const source = darkArtwork ? fieldDark : fieldLight;
  // Subtle like the screenshot (low contrast watermark)
  const sheetOpacity = darkArtwork ? 0.36 : 0.3;
  const tileStyle = { width: stripW, height: stripH, opacity: sheetOpacity };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backgroundDeep }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: 0.97 }]} />
      <Animated.View
        collapsable={false}
        style={[styles.clip, fieldStyle]}
      >
        <Animated.View
          collapsable={false}
          style={[
            {
              position: 'absolute',
              top: (winH - stripH) / 2,
              // Lead tile sits off-screen left so RTL-flipped +X still has coverage.
              left: -stripW,
              flexDirection: 'row',
              width: stripW * 3,
              height: stripH,
            },
            rowStyle,
          ]}
        >
          <Image source={source} resizeMode="stretch" style={tileStyle} />
          <Image source={source} resizeMode="stretch" style={tileStyle} />
          <Image source={source} resizeMode="stretch" style={tileStyle} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    direction: 'ltr',
  },
});
