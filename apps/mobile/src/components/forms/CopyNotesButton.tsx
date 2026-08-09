import { useEffect, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useToast } from '@/components/feedback/Toast';
import { useLocale } from '@/i18n';
import { haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  value: string | null | undefined;
  /** Accessibility hint context, e.g. field label. */
  label?: string;
  disabled?: boolean;
};

/** How long the check stays fully visible before easing back. */
const HOLD_MS = 900;
/** Soft morph back to copy icon. */
const RETURN_MS = 420;

/** Compact copy control — check confirms on-icon, then eases back to copy. */
export function CopyNotesButton({ value, label, disabled }: Props) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const reduceMotion = useReducedMotion();
  const text = (value ?? '').trim();
  const canCopy = Boolean(text) && !disabled;
  const [busy, setBusy] = useState(false);
  const [announcedCopied, setAnnouncedCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearBusyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 0 = copy, 1 = check */
  const morph = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      if (clearBusyTimer.current) clearTimeout(clearBusyTimer.current);
    };
  }, []);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const copyStyle = useAnimatedStyle(() => {
    const p = morph.value;
    return {
      opacity: interpolate(p, [0, 0.35, 1], [1, 0.15, 0]),
      transform: [
        { scale: interpolate(p, [0, 1], [1, 0.86]) },
        { rotate: `${interpolate(p, [0, 1], [0, -8])}deg` },
      ],
    };
  });

  const checkStyle = useAnimatedStyle(() => {
    const p = morph.value;
    return {
      opacity: interpolate(p, [0, 0.4, 1], [0, 0.85, 1]),
      transform: [
        { scale: interpolate(p, [0, 0.55, 1], [0.7, 1.12, 1]) },
        { rotate: `${interpolate(p, [0, 1], [12, 0])}deg` },
      ],
    };
  });

  const playSuccess = () => {
    setBusy(true);
    setAnnouncedCopied(true);

    if (reduceMotion) {
      morph.value = 1;
      scale.value = 1;
    } else {
      morph.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
      scale.value = withSequence(
        withTiming(0.88, { duration: 70, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 14, stiffness: 220, mass: 0.6 }),
      );
    }

    if (resetTimer.current) clearTimeout(resetTimer.current);
    if (clearBusyTimer.current) clearTimeout(clearBusyTimer.current);

    resetTimer.current = setTimeout(() => {
      setAnnouncedCopied(false);
      if (reduceMotion) {
        morph.value = 0;
        scale.value = 1;
        setBusy(false);
        return;
      }

      // Ease check away and bring copy back in one continuous morph — no snap.
      morph.value = withTiming(0, {
        duration: RETURN_MS,
        easing: Easing.inOut(Easing.cubic),
      });
      scale.value = withSequence(
        withTiming(0.94, {
          duration: RETURN_MS * 0.35,
          easing: Easing.out(Easing.quad),
        }),
        withSpring(1, { damping: 16, stiffness: 180, mass: 0.7 }),
      );

      clearBusyTimer.current = setTimeout(() => {
        setBusy(false);
      }, RETURN_MS + 40);
    }, HOLD_MS);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={announcedCopied ? t('mobile.copied') : t('mobile.copyNotes')}
      accessibilityHint={label}
      accessibilityState={{ disabled: !canCopy }}
      disabled={!canCopy || busy}
      hitSlop={8}
      onPress={() => {
        void (async () => {
          try {
            await Clipboard.setStringAsync(text);
            void haptics.selection();
            playSuccess();
          } catch {
            void haptics.error();
            showToast({ variant: 'error', message: t('mobile.copyFailed') });
          }
        })();
      }}
      style={{
        minWidth: theme.sizes.touch.min - 8,
        minHeight: theme.sizes.touch.min - 8,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: canCopy ? 1 : 0.35,
      }}
    >
      <Animated.View style={[{ width: 22, height: 22 }, shellStyle]}>
        <View style={{ width: 22, height: 22 }}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                alignItems: 'center',
                justifyContent: 'center',
              },
              copyStyle,
            ]}
          >
            <Ionicons name="copy-outline" size={18} color={colors.brand} />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                alignItems: 'center',
                justifyContent: 'center',
              },
              checkStyle,
            ]}
          >
            <Ionicons name="checkmark" size={20} color={colors.success} />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}
