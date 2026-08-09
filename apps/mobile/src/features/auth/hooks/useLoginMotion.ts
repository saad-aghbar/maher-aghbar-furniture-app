import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/motion/useReducedMotion';
import {
  formInteractiveAtMs,
  loginDuration,
  loginMotion,
  strokesCompleteAtMs,
  totalIntroMs,
  type LoginPhase,
} from '../motion/loginMotion';

export function useLoginMotion() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<LoginPhase>('idle');
  const [formReady, setFormReady] = useState(reduce);

  const canvas = useSharedValue(0);
  const stroke0 = useSharedValue(0);
  const stroke1 = useSharedValue(0);
  const stroke2 = useSharedValue(0);
  const stroke3 = useSharedValue(0);
  const strokesOpacity = useSharedValue(1);
  const markProgress = useSharedValue(0);
  const markOpacity = useSharedValue(0);
  const lockupOpacity = useSharedValue(0);
  const sheen = useSharedValue(0);
  const copyOpacity = useSharedValue(0);
  const copyY = useSharedValue(14);
  const chromeOpacity = useSharedValue(0);
  const formOpacity = useSharedValue(0);
  const formY = useSharedValue(32);
  const field0 = useSharedValue(0);
  const field1 = useSharedValue(0);
  const field2 = useSharedValue(0);
  const breath = useSharedValue(1);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const successScale = useSharedValue(1);

  const strokes = useMemo(
    () => [stroke0, stroke1, stroke2, stroke3] as const,
    [stroke0, stroke1, stroke2, stroke3],
  );

  const startIntro = useCallback(() => {
    const ease = Easing.out(Easing.cubic);

    if (reduce) {
      canvas.value = 1;
      strokes.forEach((s) => {
        s.value = 1;
      });
      strokesOpacity.value = 0;
      markProgress.value = 1;
      markOpacity.value = 0;
      lockupOpacity.value = 1;
      sheen.value = 0;
      copyOpacity.value = 1;
      copyY.value = 0;
      chromeOpacity.value = 1;
      formOpacity.value = 1;
      formY.value = 0;
      field0.value = 1;
      field1.value = 1;
      field2.value = 1;
      setPhase('ready');
      setFormReady(true);
      return;
    }

    setPhase('strokes');
    canvas.value = withTiming(1, {
      duration: loginDuration(loginMotion.canvasFade, false),
      easing: ease,
    });

    const strokeStart = loginMotion.canvasFade * 0.35;
    strokes.forEach((s, i) => {
      s.value = withDelay(
        strokeStart + i * loginMotion.strokeStagger,
        withTiming(1, {
          duration: loginDuration(loginMotion.strokeDraw, false),
          easing: Easing.inOut(Easing.cubic),
        }),
      );
    });

    const markAt = strokesCompleteAtMs() * 0.85;
    markProgress.value = withDelay(
      markAt,
      withTiming(1, { duration: loginDuration(loginMotion.markReveal, false), easing: ease }),
    );
    markOpacity.value = withDelay(
      markAt,
      withSequence(
        withTiming(1, { duration: loginDuration(loginMotion.markReveal, false), easing: ease }),
        withDelay(
          loginMotion.lockupCrossfade * 0.4,
          withTiming(0, { duration: loginDuration(260, false) }),
        ),
      ),
    );

    const lockupAt = markAt + loginMotion.markReveal * 0.65;
    lockupOpacity.value = withDelay(
      lockupAt,
      withTiming(1, {
        duration: loginDuration(loginMotion.lockupCrossfade, false),
        easing: ease,
      }),
    );
    strokesOpacity.value = withDelay(
      lockupAt,
      withTiming(0, { duration: loginDuration(320, false) }),
    );

    sheen.value = withDelay(
      lockupAt + 200,
      withRepeat(
        withTiming(1, {
          duration: loginMotion.sheenSweep,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );

    const copyAt = lockupAt + loginMotion.lockupCrossfade * 0.45;
    copyOpacity.value = withDelay(
      copyAt,
      withTiming(1, { duration: loginDuration(loginMotion.copyFade, false), easing: ease }),
    );
    copyY.value = withDelay(
      copyAt,
      withTiming(0, { duration: loginDuration(loginMotion.copyFade, false), easing: ease }),
    );

    chromeOpacity.value = withDelay(
      strokeStart + loginMotion.strokeDraw * 0.5,
      withTiming(1, { duration: loginDuration(loginMotion.chromeFade, false), easing: ease }),
    );

    const formAt = copyAt + loginMotion.copyFade * 0.35;
    formOpacity.value = withDelay(
      formAt,
      withTiming(1, { duration: loginDuration(loginMotion.formRise, false), easing: ease }),
    );
    formY.value = withDelay(
      formAt,
      withTiming(0, { duration: loginDuration(loginMotion.formRise, false), easing: ease }),
    );
    field0.value = withDelay(formAt, withTiming(1, { duration: 280, easing: ease }));
    field1.value = withDelay(
      formAt + loginMotion.fieldStagger,
      withTiming(1, { duration: 280, easing: ease }),
    );
    field2.value = withDelay(
      formAt + loginMotion.fieldStagger * 2 + loginMotion.buttonDelayAfterFields,
      withTiming(1, { duration: 280, easing: ease }),
    );

    const t1 = setTimeout(() => {
      setFormReady(true);
      setPhase('form');
    }, formInteractiveAtMs(false));
    const t2 = setTimeout(() => setPhase('ready'), totalIntroMs(false));

    breath.value = withDelay(
      totalIntroMs(false),
      withRepeat(
        withSequence(
          withTiming(loginMotion.idleBreathScale, {
            duration: loginMotion.idleBreathDuration / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(1, {
            duration: loginMotion.idleBreathDuration / 2,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );

    tiltX.value = withDelay(
      totalIntroMs(false),
      withRepeat(
        withSequence(
          withTiming(loginMotion.idleTiltDeg, {
            duration: 4200,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-loginMotion.idleTiltDeg, {
            duration: 4200,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        true,
      ),
    );
    tiltY.value = withDelay(
      totalIntroMs(false) + 400,
      withRepeat(
        withSequence(
          withTiming(-loginMotion.idleTiltDeg * 0.7, {
            duration: 5100,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(loginMotion.idleTiltDeg * 0.7, {
            duration: 5100,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        true,
      ),
    );

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [
    breath,
    canvas,
    chromeOpacity,
    copyOpacity,
    copyY,
    field0,
    field1,
    field2,
    formOpacity,
    formY,
    lockupOpacity,
    markOpacity,
    markProgress,
    reduce,
    sheen,
    strokes,
    strokesOpacity,
    tiltX,
    tiltY,
  ]);

  useEffect(() => {
    const cleanup = startIntro();
    return () => {
      cleanup?.();
      cancelAnimation(breath);
      cancelAnimation(sheen);
      cancelAnimation(tiltX);
      cancelAnimation(tiltY);
    };
  }, [breath, sheen, startIntro, tiltX, tiltY]);

  const pauseIdle = useCallback(() => {
    cancelAnimation(breath);
    cancelAnimation(tiltX);
    cancelAnimation(tiltY);
    breath.value = withTiming(1, { duration: 200 });
    tiltX.value = withTiming(0, { duration: 200 });
    tiltY.value = withTiming(0, { duration: 200 });
  }, [breath, tiltX, tiltY]);

  const resumeIdle = useCallback(() => {
    if (reduce || phase !== 'ready') return;
    breath.value = withRepeat(
      withSequence(
        withTiming(loginMotion.idleBreathScale, {
          duration: loginMotion.idleBreathDuration / 2,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(1, {
          duration: loginMotion.idleBreathDuration / 2,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );
  }, [breath, phase, reduce]);

  const playSuccessExit = useCallback(() => {
    setPhase('success');
    pauseIdle();
    cancelAnimation(sheen);
    if (reduce) return;
    successScale.value = withTiming(0.94, { duration: 400, easing: Easing.out(Easing.cubic) });
    formOpacity.value = withTiming(0, { duration: 420 });
    formY.value = withTiming(18, { duration: 420 });
    copyOpacity.value = withTiming(0, { duration: 300 });
    canvas.value = withTiming(1.2, { duration: 500 });
  }, [canvas, copyOpacity, formOpacity, formY, pauseIdle, reduce, sheen, successScale]);

  return useMemo(
    () => ({
      reduce,
      phase,
      formReady,
      canvas,
      strokes,
      strokesOpacity,
      markProgress,
      markOpacity,
      lockupOpacity,
      sheen,
      copyOpacity,
      copyY,
      chromeOpacity,
      formOpacity,
      formY,
      field0,
      field1,
      field2,
      breath,
      tiltX,
      tiltY,
      successScale,
      pauseIdle,
      resumeIdle,
      playSuccessExit,
    }),
    [
      breath,
      canvas,
      chromeOpacity,
      copyOpacity,
      copyY,
      field0,
      field1,
      field2,
      formOpacity,
      formReady,
      formY,
      lockupOpacity,
      markOpacity,
      markProgress,
      pauseIdle,
      phase,
      playSuccessExit,
      reduce,
      resumeIdle,
      sheen,
      strokes,
      strokesOpacity,
      successScale,
      tiltX,
      tiltY,
    ],
  );
}

export type LoginMotion = ReturnType<typeof useLoginMotion>;
