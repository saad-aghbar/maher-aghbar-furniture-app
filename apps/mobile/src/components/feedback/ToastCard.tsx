import { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { rowDirection, startEdge } from '@/i18n/rtl';
import { AnimatedPressable, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { toastChrome } from './toastChrome';
import type { ToastVariant } from './toastQueue';

type Props = {
  message: string;
  variant: ToastVariant;
  onPress?: () => void;
  /** When set, a hairline timer drains across the duration. */
  durationMs?: number;
};

function ToastTimer({
  durationMs,
  color,
  track,
  isRTL,
}: {
  durationMs: number;
  color: string;
  track: string;
  isRTL: boolean;
}) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      progress.value = 1;
      return;
    }
    progress.value = 1;
    progress.value = withTiming(0, {
      duration: durationMs,
      easing: Easing.linear,
    });
  }, [durationMs, progress, reduce]);

  const fill = useAnimatedStyle(() => ({
    width: `${Math.max(0, progress.value) * 100}%`,
  }));

  return (
    <View
      style={{
        height: 3,
        backgroundColor: track,
        flexDirection: rowDirection(isRTL),
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            backgroundColor: color,
            opacity: 0.85,
          },
          fill,
        ]}
      />
    </View>
  );
}

/** Shared toast surface — live host and the dev gallery render the same card. */
export function ToastCard({ message, variant, onPress, durationMs }: Props) {
  const { colors, theme, colorScheme } = useTheme();
  const { t, isRTL, locale } = useLocale();
  const chrome = toastChrome(variant, colors);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const woodError = variant === 'error';
  const liquorice = colorScheme === 'dark' ? colors.surface : colors.textPrimary;
  const cream = colorScheme === 'dark' ? colors.textPrimary : colors.background;
  const cardBg = woodError ? liquorice : colors.surface;
  const bodyColor = woodError ? cream : colors.textPrimary;
  const kickerColor = woodError ? colors.brand : chrome.fg;
  const closeColor = woodError ? colors.brand : colors.textMuted;
  const stripe = woodError ? colors.brandActive : chrome.accent;

  const body = (
    <View>
      <View
        style={{
          flexDirection: rowDirection(isRTL),
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm + 2,
          paddingLeft: isRTL ? theme.spacing.md : theme.spacing.md + 4,
          paddingRight: isRTL ? theme.spacing.md + 4 : theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'medium' : 'semibold'}
            style={{
              color: kickerColor,
              letterSpacing: locale === 'ar' ? 0 : 0.2,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t(chrome.labelKey)}
          </AppText>
          <AppText
            variant="bodySecondary"
            weight={titleWeight}
            numberOfLines={3}
            style={{ color: bodyColor, textAlign: isRTL ? 'right' : 'left' }}
          >
            {message}
          </AppText>
        </View>

        {onPress ? (
          <Ionicons
            name="close"
            size={18}
            color={closeColor}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
      </View>
      {durationMs != null && durationMs > 0 ? (
        <ToastTimer
          durationMs={durationMs}
          color={stripe}
          track={woodError ? 'rgba(225, 223, 211, 0.12)' : colors.surfaceSecondary}
          isRTL={isRTL}
        />
      ) : null}
    </View>
  );

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        ...theme.elevation.raised,
      }}
    >
      <View
        style={{
          overflow: 'hidden',
          borderRadius: theme.radius.xl,
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor: woodError ? colors.brandActive : colors.borderStrong,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: stripe,
            opacity: 0.95,
            zIndex: 1,
            [startEdge(isRTL)]: 0,
          }}
        />
        {onPress ? (
          <AnimatedPressable
            variant="card"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${t(chrome.labelKey)}. ${message}. ${t('mobile.toast.dismiss')}`}
            onPress={onPress}
          >
            {body}
          </AnimatedPressable>
        ) : (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${t(chrome.labelKey)}. ${message}`}
          >
            {body}
          </View>
        )}
      </View>
    </View>
  );
}
