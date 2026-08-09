import { Image, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { LoginColors } from '../theme/loginColors';
import type { LoginMotion } from '../hooks/useLoginMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const markLight = require('../../../../assets/brand/logomark-on-light.png');
const markDark = require('../../../../assets/brand/logomark-on-dark.png');

const LINE_LENGTH = 320;

const STROKES = [
  { d: 'M 40 360 C 60 280, 80 200, 110 120', len: LINE_LENGTH },
  { d: 'M 160 380 C 155 300, 150 220, 148 100', len: LINE_LENGTH },
  { d: 'M 260 350 C 230 270, 200 190, 175 115', len: LINE_LENGTH },
  { d: 'M 90 200 C 120 170, 160 150, 210 140', len: LINE_LENGTH * 0.75 },
] as const;

function StrokePath({
  d,
  length,
  progress,
  color,
}: {
  d: string;
  length: number;
  progress: SharedValue<number>;
  color: string;
}) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - progress.value),
  }));

  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={`${length} ${length}`}
      animatedProps={animatedProps}
    />
  );
}

type Props = {
  colors: LoginColors;
  darkArtwork: boolean;
  strokes: LoginMotion['strokes'];
  strokesOpacity: SharedValue<number>;
  markProgress: SharedValue<number>;
  markOpacity: SharedValue<number>;
};

/**
 * Multi-stroke craft lines that resolve into the authentic logomark PNG.
 */
export function AnimatedLogoStroke({
  colors,
  darkArtwork,
  strokes,
  strokesOpacity,
  markProgress,
  markOpacity,
}: Props) {
  const lineLayer = useAnimatedStyle(() => ({
    opacity: strokesOpacity.value,
  }));

  const markClipStyle = useAnimatedStyle(() => {
    const p = markProgress.value;
    return {
      opacity: markOpacity.value,
      height: interpolate(p, [0, 1], [6, 100]),
      transform: [{ scale: interpolate(p, [0, 1], [0.92, 1]) }],
    };
  });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.lineLayer, lineLayer]}>
        <Svg width={280} height={300} viewBox="0 0 300 400">
          {STROKES.map((s, i) => {
            const progress = strokes[i];
            if (!progress) return null;
            return (
              <StrokePath
                key={s.d}
                d={s.d}
                length={s.len}
                progress={progress}
                color={colors.brandGold}
              />
            );
          })}
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.markClip, markClipStyle]}>
        <Image
          source={darkArtwork ? markDark : markLight}
          style={styles.mark}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 280,
    height: 300,
    alignItems: 'center',
    justifyContent: 'flex-end',
    direction: 'ltr',
  },
  lineLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markClip: {
    overflow: 'hidden',
    width: 128,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 88,
  },
  mark: {
    width: 118,
    height: 100,
  },
});
