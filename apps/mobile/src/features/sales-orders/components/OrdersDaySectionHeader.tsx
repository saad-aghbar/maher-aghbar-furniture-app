import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, useReducedMotion } from '@/motion';
import { durations, withMotionDuration } from '@/motion/presets';
import { useTheme } from '@/theme';
import type { FloorBoardSectionKey } from '../groupOrdersByDay';
import { orderBoardShadow } from './orderFloorStyle';

type Props = {
  title: string;
  count: number;
  sectionKey: FloorBoardSectionKey;
  expanded: boolean;
  onToggle: () => void;
};

function sectionMeta(
  key: FloorBoardSectionKey,
  colors: ReturnType<typeof useTheme>['colors'],
): {
  accent: string;
  soft: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  if (key === 'today') {
    return {
      accent: colors.brand,
      soft: colors.brandSoft,
      icon: 'sunny-outline',
    };
  }
  return {
    accent: colors.warning,
    soft: colors.warningSoft,
    icon: 'time-outline',
  };
}

/**
 * Today / Past section header — elevated floor board with chevron toggle.
 */
export function OrdersDaySectionHeader({
  title,
  count,
  sectionKey,
  expanded,
  onToggle,
}: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const rotate = useSharedValue(expanded ? 1 : 0);
  const { accent, soft, icon } = sectionMeta(sectionKey, colors);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  useEffect(() => {
    const d = withMotionDuration(durations.chip, reduce);
    rotate.value = reduce
      ? expanded
        ? 1
        : 0
      : withTiming(expanded ? 1 : 0, { duration: d });
  }, [expanded, reduce, rotate]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${(isRTL ? 90 : -90) + rotate.value * (isRTL ? -90 : 90)}deg`,
      },
    ],
  }));

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${title} ${count}`}
      onPress={onToggle}
      style={{
        marginTop: theme.spacing.sm,
        marginBottom: theme.spacing.sm,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: expanded ? accent : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: expanded ? 0.9 : 0.45,
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          minHeight: theme.sizes.touch.min,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: expanded ? soft : 'transparent',
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flex: 1,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
            }}
          >
            <Ionicons name={icon} size={16} color={accent} />
          </View>
          <AppText variant="label" weight={titleWeight} style={{ color: accent, flexShrink: 1 }}>
            {title}
          </AppText>
        </View>
        <View
          style={{
            minWidth: 28,
            height: 28,
            paddingHorizontal: 8,
            borderRadius: 14,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            dir="ltr"
            style={{ color: colors.brand, fontVariant: ['tabular-nums'] }}
          >
            {String(count)}
          </AppText>
        </View>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.View style={chevronStyle}>
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={14}
              color={colors.brand}
            />
          </Animated.View>
        </View>
      </View>
    </AnimatedPressable>
  );
}
