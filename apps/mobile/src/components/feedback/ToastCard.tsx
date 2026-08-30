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
import { AnimatedPressable, useReducedMotion } from '@/motion';
import { attentionChrome, useTheme } from '@/theme';
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
  isRTL,
}: {
  durationMs: number;
  color: string;
  isRTL: boolean;
}) {
  const reduce = useReducedMotion();
  const { colors } = useTheme();
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
        backgroundColor: colors.surfaceSecondary,
        flexDirection: isRTL ? 'row-reverse' : 'row',
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
  const { colors, theme } = useTheme();
  const { t, isRTL, locale } = useLocale();
  const chrome = toastChrome(variant, colors);
  const attention = attentionChrome(colors);
  const inkToast = variant === 'error' || variant === 'warning';
  const cardBg = inkToast ? attention.surface : colors.surface;
  const cardBorder = inkToast ? attention.border : colors.borderStrong;
  const titleColor = inkToast ? attention.on : colors.textPrimary;
  const labelColor = inkToast ? attention.accent : chrome.fg;
  const iconFg = inkToast ? attention.accent : chrome.fg;
  const iconSoft = inkToast ? 'rgba(183, 155, 123, 0.18)' : chrome.soft;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const body = (
    <View>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm + 2,
          paddingLeft: isRTL ? theme.spacing.md : theme.spacing.md + 4,
          paddingRight: isRTL ? theme.spacing.md + 4 : theme.spacing.md,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.radius.lg,
            backgroundColor: iconSoft,
            borderWidth: 1,
            borderColor: inkToast ? attention.border : colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={chrome.icon} size={18} color={iconFg} />
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            style={{
              color: labelColor,
              letterSpacing: locale === 'ar' ? 0 : 0.6,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t(chrome.labelKey)}
          </AppText>
          <AppText
            variant="bodySecondary"
            weight={titleWeight}
            numberOfLines={3}
            style={{ textAlign: isRTL ? 'right' : 'left', color: titleColor }}
          >
            {message}
          </AppText>
        </View>

        {onPress ? (
          <Ionicons
            name="close"
            size={16}
            color={inkToast ? attention.muted : colors.textMuted}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
      </View>
      {durationMs != null && durationMs > 0 ? (
        <ToastTimer durationMs={durationMs} color={chrome.accent} isRTL={isRTL} />
      ) : null}
    </View>
  );

  return (
    <View
      style={{
        borderRadius: theme.radius.card,
        ...theme.elevation.raised,
      }}
    >
      <View
        style={{
          overflow: 'hidden',
          borderRadius: theme.radius.card,
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor: cardBorder,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: inkToast ? attention.accent : chrome.accent,
            opacity: 0.9,
            zIndex: 1,
            ...(isRTL ? { right: 0 } : { left: 0 }),
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
