import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { haptics } from '@/motion';
import {
  brandIntroTimeline as T,
  brandIntroTotalMs,
  consumeBrandIntroMode,
  markBrandIntroCompleted,
  type BrandIntroMode,
  type BrandIntroPhase,
} from '@/theme/brandIntroMotion';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';

export type UseBrandIntroStateOptions = {
  autoPlay?: boolean;
  onAnimationStart?: () => void;
  onLogoDrawn?: () => void;
  onLoginReveal?: () => void;
  onAnimationComplete?: () => void;
  onComplete?: () => void;
};

const easeOut = Easing.out(Easing.cubic);
/** Soft land from oversized → peak (Netflix slam, not snappy) */
const slamEase = Easing.bezier(0.22, 1, 0.36, 1);
/** Gentle settle after peak into hold size */
const slamSettleEase = Easing.bezier(0.45, 0, 0.2, 1);
/** Lockup body / slot rise */
const riseEase = Easing.bezier(0.22, 1, 0.36, 1);
/** Soft dissolve for veil / bg */
const dissolveEase = Easing.bezier(0.4, 0, 0.2, 1);

const dockSpring = {
  damping: 20,
  stiffness: 78,
  mass: 0.92,
  overshootClamping: false,
} as const;

export function useBrandIntroState(options: UseBrandIntroStateOptions = {}) {
  const {
    autoPlay = true,
    onAnimationStart,
    onLogoDrawn,
    onLoginReveal,
    onAnimationComplete,
    onComplete,
  } = options;

  const reduce = useReducedMotionPreference();
  const modeRef = useRef<BrandIntroMode>(consumeBrandIntroMode(reduce));
  const [phase, setPhase] = useState<BrandIntroPhase>('idle');
  const [formInteractive, setFormInteractive] = useState(false);
  const completedRef = useRef(false);
  const startedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const veilOpacity = useSharedValue(1);
  /** Flying sofa-M */
  const mOpacity = useSharedValue(0);
  /** Scale relative to seated M size (1 = seated) */
  const mScale = useSharedValue(T.slamScaleFrom as number);
  /** 0 = screen center, 1 = lockup M seat */
  const mDock = useSharedValue(0);
  /** Lockup body without M */
  const bodyOpacity = useSharedValue(0);
  /** 0 = mid, 1 = final header Y for lockup assembly */
  const logoSlot = useSharedValue(0);
  const chromeOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(14);
  const subtitleOpacity = useSharedValue(0);
  const subtitleY = useSharedValue(14);
  const field0 = useSharedValue(0);
  const field0Y = useSharedValue(16);
  const field1 = useSharedValue(0);
  const field1Y = useSharedValue(16);
  const buttonOpacity = useSharedValue(0);
  const buttonY = useSharedValue(16);
  const bgProgress = useSharedValue(0);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const finishOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    markBrandIntroCompleted();
    setPhase((p) => (p === 'skipped' ? 'skipped' : 'complete'));
    setFormInteractive(true);
    onAnimationComplete?.();
    onComplete?.();
  }, [onAnimationComplete, onComplete]);

  const revealLogin = useCallback(
    (delayMs: number) => {
      chromeOpacity.value = withDelay(
        delayMs,
        withTiming(1, { duration: T.revealGroupMs, easing: easeOut }),
      );
      const bump = (op: typeof titleOpacity, y: typeof titleY, d: number) => {
        op.value = withDelay(d, withTiming(1, { duration: T.revealGroupMs, easing: easeOut }));
        y.value = withDelay(d, withTiming(0, { duration: T.revealGroupMs, easing: easeOut }));
      };
      bump(titleOpacity, titleY, delayMs);
      bump(subtitleOpacity, subtitleY, delayMs + T.revealStaggerMs);
      bump(field0, field0Y, delayMs + T.revealStaggerMs * 2);
      bump(field1, field1Y, delayMs + T.revealStaggerMs * 3);
      buttonOpacity.value = withDelay(
        delayMs + T.revealStaggerMs * 4,
        withTiming(1, { duration: T.revealGroupMs, easing: easeOut }),
      );
      buttonY.value = withDelay(
        delayMs + T.revealStaggerMs * 4,
        withTiming(0, { duration: T.revealGroupMs, easing: easeOut }),
      );
    },
    [
      buttonOpacity,
      buttonY,
      chromeOpacity,
      field0,
      field0Y,
      field1,
      field1Y,
      subtitleOpacity,
      subtitleY,
      titleOpacity,
      titleY,
    ],
  );

  const applyFinal = useCallback(
    (animated: boolean) => {
      const d = animated ? 240 : 0;
      const cfg = { duration: d, easing: easeOut };
      veilOpacity.value = withTiming(0, cfg);
      mOpacity.value = withTiming(1, cfg);
      mScale.value = withTiming(1, cfg);
      mDock.value = withTiming(1, cfg);
      bodyOpacity.value = withTiming(1, cfg);
      logoSlot.value = withTiming(1, cfg);
      chromeOpacity.value = withTiming(1, cfg);
      titleOpacity.value = withTiming(1, cfg);
      titleY.value = withTiming(0, cfg);
      subtitleOpacity.value = withTiming(1, cfg);
      subtitleY.value = withTiming(0, cfg);
      field0.value = withTiming(1, cfg);
      field0Y.value = withTiming(0, cfg);
      field1.value = withTiming(1, cfg);
      field1Y.value = withTiming(0, cfg);
      buttonOpacity.value = withTiming(1, cfg);
      buttonY.value = withTiming(0, cfg);
      bgProgress.value = withTiming(1, cfg);
    },
    [
      bgProgress,
      bodyOpacity,
      buttonOpacity,
      buttonY,
      chromeOpacity,
      field0,
      field0Y,
      field1,
      field1Y,
      logoSlot,
      mDock,
      mOpacity,
      mScale,
      subtitleOpacity,
      subtitleY,
      titleOpacity,
      titleY,
      veilOpacity,
    ],
  );

  const runReduced = useCallback(() => {
    setPhase('loginRevealing');
    onAnimationStart?.();
    applyFinal(true);
    setFormInteractive(true);
    onLogoDrawn?.();
    onLoginReveal?.();
    timersRef.current.push(setTimeout(() => finishOnce(), T.reducedFadeMs + 40));
  }, [applyFinal, finishOnce, onAnimationStart, onLoginReveal, onLogoDrawn]);

  const runShort = useCallback(() => {
    setPhase('settled');
    onAnimationStart?.();
    veilOpacity.value = 0;
    mOpacity.value = 0;
    mScale.value = 1;
    mDock.value = 1;
    bodyOpacity.value = 0;
    logoSlot.value = 1;
    mOpacity.value = withTiming(1, { duration: T.shortRevealMs * 0.5, easing: easeOut });
    bodyOpacity.value = withTiming(1, { duration: T.shortRevealMs * 0.5, easing: easeOut });
    bgProgress.value = 1;
    revealLogin(40);
    setFormInteractive(true);
    onLogoDrawn?.();
    onLoginReveal?.();
    timersRef.current.push(setTimeout(() => finishOnce(), T.shortRevealMs + 80));
  }, [
    bgProgress,
    bodyOpacity,
    finishOnce,
    logoSlot,
    mDock,
    mOpacity,
    mScale,
    onAnimationStart,
    onLoginReveal,
    onLogoDrawn,
    revealLogin,
    veilOpacity,
  ]);

  const runFull = useCallback(() => {
    setPhase('slamming');
    onAnimationStart?.();

    veilOpacity.value = 1;
    mOpacity.value = 0;
    mScale.value = T.slamScaleFrom;
    mDock.value = 0;
    bodyOpacity.value = 0;
    logoSlot.value = 0;
    bgProgress.value = 0;

    const slamAt = T.veilHold;
    // Soft fade-in so the mark doesn't pop
    mOpacity.value = withDelay(
      slamAt,
      withTiming(1, { duration: Math.round(T.slamMs * 0.38), easing: easeOut }),
    );
    // Oversized → gentle overshoot peak → settle to hold size
    mScale.value = withDelay(
      slamAt,
      withSequence(
        withTiming(T.slamScalePeak, {
          duration: Math.round(T.slamMs * 0.72),
          easing: slamEase,
        }),
        withTiming(T.slamScaleHold, {
          duration: Math.round(T.slamMs * 0.28),
          easing: slamSettleEase,
        }),
      ),
    );

    timersRef.current.push(
      setTimeout(() => {
        void haptics.confirmMedium();
        onLogoDrawn?.();
        setPhase('holding');
      }, slamAt + Math.round(T.slamMs * 0.72)),
    );

    // Lockup body eases in near end of hold so the empty seat is ready
    const bodyAt = T.veilHold + T.slamMs + Math.round(T.holdMs * 0.35);
    logoSlot.value = withDelay(
      bodyAt,
      withTiming(1, { duration: Math.round(T.holdMs * 0.75 + T.dockMs * 0.35), easing: riseEase }),
    );
    bodyOpacity.value = withDelay(
      bodyAt,
      withTiming(1, { duration: Math.round(T.holdMs * 0.55 + T.dockMs * 0.25), easing: easeOut }),
    );

    const dockAt = T.veilHold + T.slamMs + T.holdMs;
    timersRef.current.push(setTimeout(() => setPhase('docking'), dockAt));

    // Spring dock — organic settle into the M seat
    mDock.value = withDelay(dockAt, withSpring(1, dockSpring));
    mScale.value = withDelay(dockAt, withSpring(1, dockSpring));

    // Page loads *during* the dock flight (not after landing)
    const revealAt = dockAt + Math.round(T.dockMs * 0.12);
    veilOpacity.value = withDelay(
      revealAt,
      withTiming(0, { duration: T.settleMs, easing: dissolveEase }),
    );
    bgProgress.value = withDelay(
      revealAt,
      withTiming(1, { duration: T.settleMs, easing: dissolveEase }),
    );

    timersRef.current.push(
      setTimeout(() => {
        setPhase('loginRevealing');
        onLoginReveal?.();
        setFormInteractive(true);
      }, revealAt + 40),
    );
    revealLogin(revealAt + 20);

    timersRef.current.push(
      setTimeout(() => {
        void haptics.confirmLight();
        setPhase('settled');
      }, dockAt + T.dockMs),
    );

    timersRef.current.push(
      setTimeout(() => finishOnce(), brandIntroTotalMs('full') + 60),
    );
  }, [
    bgProgress,
    bodyOpacity,
    finishOnce,
    logoSlot,
    mDock,
    mOpacity,
    mScale,
    onAnimationStart,
    onLoginReveal,
    onLogoDrawn,
    revealLogin,
    veilOpacity,
  ]);

  const start = useCallback(() => {
    if (startedRef.current || completedRef.current) return;
    startedRef.current = true;
    const mode = modeRef.current;
    if (mode === 'reduced') runReduced();
    else if (mode === 'short') runShort();
    else runFull();
  }, [runFull, runReduced, runShort]);

  const skip = useCallback(() => {
    if (completedRef.current) return;
    clearTimers();
    cancelAnimation(veilOpacity);
    cancelAnimation(mOpacity);
    cancelAnimation(mScale);
    cancelAnimation(mDock);
    cancelAnimation(bodyOpacity);
    cancelAnimation(logoSlot);
    setPhase('skipped');
    applyFinal(true);
    setFormInteractive(true);
    onLogoDrawn?.();
    onLoginReveal?.();
    timersRef.current.push(setTimeout(() => finishOnce(), 260));
  }, [
    applyFinal,
    bodyOpacity,
    clearTimers,
    finishOnce,
    logoSlot,
    mDock,
    mOpacity,
    mScale,
    onLoginReveal,
    onLogoDrawn,
    veilOpacity,
  ]);

  useEffect(() => {
    if (!autoPlay) return;
    start();
    return () => clearTimers();
  }, [autoPlay, clearTimers, start]);

  return {
    phase,
    mode: modeRef.current,
    formInteractive,
    totalMs: brandIntroTotalMs(modeRef.current),
    skipUnlockAt: T.skipUnlockAt,
    skip,
    start,
    shared: {
      veilOpacity,
      mOpacity,
      mScale,
      mDock,
      bodyOpacity,
      logoSlot,
      chromeOpacity,
      titleOpacity,
      titleY,
      subtitleOpacity,
      subtitleY,
      field0,
      field0Y,
      field1,
      field1Y,
      buttonOpacity,
      buttonY,
      bgProgress,
      // Compat
      logoOpacity: mOpacity,
      logoScale: mScale,
      lineOpacity: veilOpacity,
      riseProgress: logoSlot,
      stemProgress: mOpacity,
      curveProgress: mOpacity,
      tailProgress: mOpacity,
      risingVisible: veilOpacity,
    },
  };
}

export type BrandIntroState = ReturnType<typeof useBrandIntroState>;
