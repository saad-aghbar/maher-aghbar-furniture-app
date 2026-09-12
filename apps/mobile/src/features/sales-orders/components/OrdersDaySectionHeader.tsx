import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { extraStartPadding, localeRow, pinStart, useLocale } from '@/i18n';
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

/**
 * Today / Past group header — parchment band, brand rail, not a warning desk.
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
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const icon = sectionKey === 'today' ? 'sunny-outline' : 'time-outline';

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
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...pinStart(isRTL),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
        }}
      />
      <View
        style={{
          flexDirection: localeRow(isRTL),
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          minHeight: theme.sizes.touch.min,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          ...extraStartPadding(isRTL, theme.spacing.md + 4),
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <View
          style={{
            flexDirection: localeRow(isRTL),
            alignItems: 'center',
            gap: theme.spacing.sm,
            flex: 1,
          }}
        >
          <Ionicons name={icon} size={16} color={colors.brand} />
          <AppText
            variant="caption"
            weight={titleWeight}
            numberOfLines={1}
            style={{
              flexShrink: 1,
              color: colors.brand,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              letterSpacing: locale === 'ar' ? 0 : 0.7,
              fontSize: 11,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {title}
          </AppText>
        </View>
        <View
          style={{
            minWidth: 28,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: theme.radius.full,
            backgroundColor: colors.brandSoft,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.brand,
            alignItems: 'center',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            dir="ltr"
            style={{ color: colors.brand, fontVariant: ['tabular-nums'], fontSize: 12 }}
          >
            {String(count)}
          </AppText>
        </View>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </Animated.View>
        </View>
      </View>
    </AnimatedPressable>
  );
}
