import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { BrandMark } from '@/components/BrandMark';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import type { LoginColors } from '../theme/loginColors';
import type { LoginMotion } from '../hooks/useLoginMotion';
import { AnimatedLogoStroke } from './AnimatedLogoStroke';

type Props = {
  motion: LoginMotion;
  colors: LoginColors;
  darkArtwork: boolean;
  keyboardOpen?: boolean;
};

/**
 * Multi-stroke write → authentic lockup + idle sheen / breath / micro-tilt.
 */
export function AnimatedBrandIntro({ motion, colors, darkArtwork, keyboardOpen }: Props) {
  const { t } = useLocale();
  const compact = keyboardOpen === true;

  const lockupStyle = useAnimatedStyle(() => {
    const sheenX = interpolate(motion.sheen.value, [0, 1], [-40, 40]);
    return {
      opacity: motion.lockupOpacity.value,
      transform: [
        { perspective: 900 },
        { rotateX: `${motion.tiltX.value}deg` },
        { rotateY: `${motion.tiltY.value}deg` },
        {
          scale:
            motion.breath.value *
            motion.successScale.value *
            (compact ? 0.85 : 1),
        },
        { translateX: sheenX * 0.02 },
      ],
    };
  });

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(motion.sheen.value, [0, 0.5, 1], [0, 0.35, 0]) * motion.lockupOpacity.value,
    transform: [
      { translateX: interpolate(motion.sheen.value, [0, 1], [-80, 80]) },
      { rotate: '-18deg' },
    ],
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: motion.copyOpacity.value,
    transform: [{ translateY: motion.copyY.value }],
  }));

  return (
    <View style={[styles.root, compact && styles.rootCompact]}>
      <View style={[styles.stage, compact && styles.stageCompact]}>
        {!compact ? (
          <AnimatedLogoStroke
            colors={colors}
            darkArtwork={darkArtwork}
            strokes={motion.strokes}
            strokesOpacity={motion.strokesOpacity}
            markProgress={motion.markProgress}
            markOpacity={motion.markOpacity}
          />
        ) : null}
        <Animated.View style={[styles.lockup, lockupStyle]}>
          <View style={styles.lockupInner}>
            <BrandMark
              variant="lockup"
              tone={darkArtwork ? 'on-dark' : 'on-light'}
              size={compact ? 'lg' : 'hero'}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.sheen, { backgroundColor: colors.specular }, sheenStyle]}
            />
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.copy, copyStyle]}>
        <AppText variant="body" align="center" style={{ color: colors.textSecondary }}>
          {t('auth.loginSubtitle')}
        </AppText>
        <AppText
          variant="caption"
          align="center"
          style={{ color: colors.textMuted, marginTop: 6 }}
        >
          {t('mobile.signInSubtitle')}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    width: '100%',
    gap: 16,
    direction: 'ltr',
  },
  rootCompact: { gap: 8 },
  stage: {
    height: 220,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageCompact: { height: 72 },
  lockup: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockupInner: {
    overflow: 'hidden',
    borderRadius: 8,
  },
  sheen: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 36,
  },
  copy: {
    paddingHorizontal: 24,
    maxWidth: 380,
    direction: 'inherit',
    width: '100%',
  },
});
