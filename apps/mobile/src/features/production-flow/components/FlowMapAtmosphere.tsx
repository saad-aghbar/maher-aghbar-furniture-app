import { useEffect, useState } from 'react';
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
 * Tiles vertically so long flow charts stay covered end-to-end.
 */
export function FlowMapAtmosphere() {
  const reduce = useReducedMotion();
  const { colors, colorScheme } = useTheme();
  const { width: winW } = useWindowDimensions();
  const drift = useSharedValue(0);
  const [panelSize, setPanelSize] = useState({ w: winW, h: 720 });

  const marksAcross = 6;
  const cellX = 61;
  const baseScale = Math.max((panelSize.w / marksAcross) / cellX, 0.5);
  const stripW = FIELD_W * baseScale;
  const stripH = FIELD_H * baseScale;
  const rows = Math.max(1, Math.ceil((panelSize.h + stripH * 0.25) / stripH) + 1);
  const cols = 2; // two strips for horizontal drift loop

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
    <View
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setPanelSize((prev) =>
            prev.w === width && prev.h === height ? prev : { w: width, h: height },
          );
        }
      }}
    >
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSecondary }]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: -stripH * 0.08,
            left: 0,
            width: stripW * cols,
            height: stripH * rows,
          },
          rowStyle,
        ]}
      >
        {Array.from({ length: rows }, (_, row) => (
          <View key={`row-${row}`} style={{ flexDirection: 'row', height: stripH }}>
            {Array.from({ length: cols }, (_, col) => (
              <Image
                key={`tile-${row}-${col}`}
                source={source}
                resizeMode="stretch"
                style={{ width: stripW, height: stripH, opacity: sheetOpacity }}
              />
            ))}
          </View>
        ))}
      </Animated.View>
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
