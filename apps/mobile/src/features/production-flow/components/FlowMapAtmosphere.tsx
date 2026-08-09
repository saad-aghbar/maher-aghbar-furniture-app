import { useEffect } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

const fieldLight = require('../../../../assets/brand/watermark-field-on-light.png');
const fieldDark = require('../../../../assets/brand/watermark-field-on-dark.png');

const FIELD_W = 976;
const FIELD_H = 1248;

/**
 * Slow drifting M-field watermark (same artwork as login), scoped to a panel.
 */
export function FlowMapAtmosphere() {
  const reduce = useReducedMotion();
  const { colors, colorScheme } = useTheme();
  const { width: winW } = useWindowDimensions();
  const drift = useSharedValue(0);

  const marksAcross = 6;
  const cellX = 61;
  const panelH = 720;
  const coverScale = Math.max((winW / marksAcross) / cellX, panelH / FIELD_H);
  const stripW = FIELD_W * coverScale;
  const stripH = FIELD_H * coverScale;

  useEffect(() => {
    if (reduce) {
      drift.value = 0;
      return;
    }
    drift.value = 0;
    drift.value = withRepeat(
      withTiming(1, { duration: 48000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [drift, reduce]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: reduce ? 0 : interpolate(drift.value, [0, 1], [0, -stripW]),
      },
    ],
  }));

  const source = colorScheme === 'dark' ? fieldDark : fieldLight;
  const sheetOpacity = colorScheme === 'dark' ? 0.28 : 0.22;

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSecondary }]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: -stripH * 0.12,
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
      {/* Soft vertical fade so nodes stay readable */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.surfaceSecondary, opacity: 0.35 },
        ]}
      />
    </View>
  );
}
