import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { BrandIntroState } from '@/hooks/useBrandIntroState';
import { useLocale } from '@/i18n';
import { brandIntroTimeline as T } from '@/theme/brandIntroMotion';

const bodyLight = require('../../../assets/brand/lockup-body-on-light.png');
const bodyDark = require('../../../assets/brand/lockup-body-on-dark.png');
const markLight = require('../../../assets/brand/watermark-mark.png');
const markDark = require('../../../assets/brand/watermark-mark-dark.png');

const LOCKUP_ASPECT = 2.45;

type Props = {
  intro: BrandIntroState;
  logoWidth?: number;
  darkArtwork?: boolean;
  testID?: string;
};

/**
 * Netflix sting: big sofa-M → flies into empty seat beside “aher” → login.
 */
export function AnimatedBrandIntro({
  intro,
  logoWidth = 240,
  darkArtwork = false,
  testID = 'brand-intro',
}: Props) {
  const { t } = useLocale();
  const { width: winW, height: winH } = useWindowDimensions();
  const frameW = useRef(0);
  const frameH = useRef(0);
  if (winW > 0 && frameW.current === 0) frameW.current = winW;
  if (winH > 0 && frameH.current === 0) frameH.current = winH;
  const layoutW = frameW.current || winW;
  const layoutH = frameH.current || winH;
  const [skipArmed, setSkipArmed] = useState(false);
  const { shared, skip, skipUnlockAt, mode, phase } = intro;

  useEffect(() => {
    if (mode !== 'full') return;
    const t = setTimeout(() => setSkipArmed(true), skipUnlockAt);
    return () => clearTimeout(t);
  }, [mode, skipUnlockAt]);

  const lockupH = logoWidth / LOCKUP_ASPECT;
  const seatW = logoWidth * T.mSlotW;
  const seatH = seatW * 1.05;
  const bodySource = darkArtwork ? bodyDark : bodyLight;
  const markSource = darkArtwork ? markDark : markLight;

  const veilStyle = useAnimatedStyle(() => ({
    opacity: shared.veilOpacity.value,
  }));

  /** Lockup body (no M) sits in header slot */
  const bodyStyle = useAnimatedStyle(() => {
    const slot = shared.logoSlot.value;
      const top = interpolate(slot, [0, 1], [layoutH * 0.36, layoutH * 0.2]);
      return {
        opacity: shared.bodyOpacity.value,
        top,
        left: (layoutW - logoWidth) / 2,
      };
  });

  /**
   * Flying M: center of screen → seat over lockup body.
   * mScale is relative to seated size (1 = seatW).
   */
  const mStyle = useAnimatedStyle(() => {
    const dock = shared.mDock.value;
    const slot = shared.logoSlot.value;
    const bodyTop = interpolate(
      slot,
      [0, 1],
      [layoutH * 0.36, layoutH * 0.2],
      Extrapolation.CLAMP,
    );
    const lockupLeft = (layoutW - logoWidth) / 2;
    const seatLeft = lockupLeft + logoWidth * T.mSlotX;
    const seatTop = bodyTop + lockupH * T.mSlotY;

    const startLeft = (layoutW - seatW) / 2;
    const startTop = layoutH * 0.38 - seatH / 2;

    // Soft ease-in path: linger mid-screen, then settle into the seat
    const left = interpolate(
      dock,
      [0, 0.55, 1],
      [startLeft, startLeft + (seatLeft - startLeft) * 0.42, seatLeft],
      Extrapolation.CLAMP,
    );
    const top = interpolate(
      dock,
      [0, 0.45, 1],
      [startTop, startTop + (seatTop - startTop) * 0.28, seatTop],
      Extrapolation.CLAMP,
    );
    const scale = shared.mScale.value;

    return {
      opacity: shared.mOpacity.value,
      left,
      top,
      width: seatW,
      height: seatH,
      transform: [{ scale }],
    };
  });

  const canSkip =
    mode === 'full' &&
    skipArmed &&
    (phase === 'slamming' || phase === 'holding' || phase === 'docking');

  return (
    <View style={styles.root} testID={testID} pointerEvents="box-none">
      {mode === 'full' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.skipIntro')}
          onPress={() => {
            if (canSkip) skip();
          }}
          style={StyleSheet.absoluteFill}
          pointerEvents={canSkip ? 'auto' : 'none'}
        />
      ) : null}

      <Animated.View pointerEvents="none" style={[styles.veil, veilStyle]} />

      <Animated.View
        pointerEvents="none"
        style={[styles.bodySlot, { width: logoWidth, height: lockupH }, bodyStyle]}
      >
        <View style={{ direction: 'ltr' }}>
          <Image
            source={bodySource}
            resizeMode="contain"
            style={{ width: logoWidth, height: lockupH }}
          />
        </View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.flyingM, mStyle]}>
        <View style={{ direction: 'ltr', width: '100%', height: '100%' }}>
          <Image
            source={markSource}
            resizeMode="contain"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0908',
    zIndex: 1,
  },
  bodySlot: {
    position: 'absolute',
    zIndex: 2,
  },
  flyingM: {
    position: 'absolute',
    zIndex: 3,
  },
});
