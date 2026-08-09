import { useCallback, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useDraggablePillBar, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

export type StatusChipKey =
  | 'all'
  | 'pending'
  | 'production'
  | 'ready'
  | 'delivered';

type OrdersFilterChipsProps = {
  value: StatusChipKey;
  onChange: (value: StatusChipKey) => void;
};

const CHIPS: StatusChipKey[] = ['all', 'pending', 'production', 'ready', 'delivered'];

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 8;
const PILL_HEIGHT = 34;
const CHIP_PAD_X = 12;
const CHIP_MIN_WIDTH = 48;

const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

const FILL_LIGHT = ['#F3EEE5', '#EEEAE4', '#F2E8E4', '#E9EBE3', '#E8EEEA'] as const;
const BORDER_LIGHT = ['#8F7A58', '#6E6254', '#7A4538', '#5A6348', '#4A6B58'] as const;
const FILL_DARK = [
  'rgba(168,144,108,0.18)',
  'rgba(181,164,140,0.20)',
  'rgba(196,137,122,0.18)',
  'rgba(154,170,122,0.18)',
  'rgba(122,170,148,0.18)',
] as const;
const BORDER_DARK = ['#A8906C', '#B5A48C', '#C4897A', '#9AAA7A', '#7AAA94'] as const;

type ChipLayout = { x: number; width: number };

function accentFor(
  chip: StatusChipKey,
  colors: {
    brand: string;
    info: string;
    warning: string;
    success: string;
    textSecondary: string;
  },
  focused: boolean,
): string {
  if (!focused) return colors.textSecondary;
  if (chip === 'pending') return colors.warning;
  if (chip === 'production') return colors.info;
  if (chip === 'ready') return colors.brand;
  if (chip === 'delivered') return colors.success;
  return colors.brand;
}

/**
 * Full-width status filter bar — Fabric bubble, tap or hold-and-scrub.
 */
export function OrdersFilterChips({ value, onChange }: OrdersFilterChipsProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<StatusChipKey, ChipLayout>>>({});

  const activeIdx = Math.max(0, CHIPS.indexOf(value));
  const dark = colorScheme === 'dark';
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;

  const orderedLayouts = useMemo(
    () => CHIPS.map((chip) => layouts[chip]),
    [layouts],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = CHIPS[index];
      if (!next || next === value) return;
      onChange(next);
    },
    [onChange, value],
  );

  const { pillX, pillW, dragging, hoverIndex, gesture } = useDraggablePillBar({
    layouts: orderedLayouts,
    activeIndex: activeIdx,
    onSelectIndex,
    reduceMotion: reduce,
    enabled: true,
    spring: BUBBLE_SPRING,
  });

  const onChipLayout = useCallback((name: StatusChipKey, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[name];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [name]: { x, width } };
    });
  }, []);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pillX.value },
      { scale: 1 + dragging.value * 0.04 },
    ],
    width: pillW.value,
    backgroundColor: interpolateColor(
      hoverIndex.value,
      [0, 1, 2, 3, 4],
      [...fills],
    ),
    borderColor: interpolateColor(hoverIndex.value, [0, 1, 2, 3, 4], [...borders]),
  }));

  const shellH = SHELL_PAD_Y * 2 + PILL_HEIGHT;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: shellH,
          borderRadius: shellH / 2,
          backgroundColor: dark ? 'rgba(42,36,37,0.92)' : colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: SHELL_PAD_Y,
          paddingHorizontal: SHELL_PAD_X,
          shadowColor: dark ? '#000000' : '#1E1A1B',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: dark ? 0.22 : 0.07,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: SHELL_PAD_Y,
              height: PILL_HEIGHT,
              left: 0,
              borderRadius: PILL_HEIGHT / 2,
              borderWidth: 1.5,
              shadowColor: dark ? '#000000' : '#1E1A1B',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: dark ? 0.25 : 0.08,
              shadowRadius: 4,
              elevation: 2,
            },
            pillStyle,
          ]}
        />

        {CHIPS.map((chip) => {
          const focused = value === chip;
          const label = t(`mobile.orders.chips.${chip}`);
          const ink = accentFor(chip, colors, focused);

          return (
            <Pressable
              key={chip}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onLayout={(e) => onChipLayout(chip, e)}
              onPress={() => {
                if (chip === value) return;
                onChange(chip);
              }}
              style={{
                height: PILL_HEIGHT,
                minWidth: CHIP_MIN_WIDTH,
                paddingHorizontal: CHIP_PAD_X,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                flexShrink: 1,
              }}
            >
              <AppText
                variant="caption"
                weight={
                  focused ? (locale === 'ar' ? 'medium' : 'semibold') : 'medium'
                }
                numberOfLines={1}
                align="center"
                style={{
                  color: ink,
                  fontSize: 12,
                  lineHeight: 15,
                  opacity: focused ? 1 : 0.82,
                }}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </GestureDetector>
  );
}
