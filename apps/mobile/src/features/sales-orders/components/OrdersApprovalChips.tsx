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
import type { OrdersApprovalFilter } from './OrdersFilterSheet';

const CHIPS: OrdersApprovalFilter[] = ['any', 'approved', 'notApproved'];

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 6;
const PILL_HEIGHT = 34;

const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

const FILL_LIGHT = ['#F3EEE5', '#E8EEEA', '#F2E8E4'] as const;
const BORDER_LIGHT = ['#8F7A58', '#4A6B58', '#7A4538'] as const;
const FILL_DARK = [
  'rgba(168,144,108,0.22)',
  'rgba(122,170,148,0.18)',
  'rgba(196,137,122,0.18)',
] as const;
const BORDER_DARK = ['#A8906C', '#7AAA94', '#C4897A'] as const;

type ChipLayout = { x: number; width: number };

type Props = {
  value: OrdersApprovalFilter;
  onChange: (next: OrdersApprovalFilter) => void;
};

function accentFor(
  chip: OrdersApprovalFilter,
  colors: {
    brand: string;
    success: string;
    warning: string;
    textSecondary: string;
  },
  focused: boolean,
): string {
  if (!focused) return colors.textSecondary;
  if (chip === 'approved') return colors.success;
  if (chip === 'notApproved') return colors.warning;
  return colors.brand;
}

/**
 * Approval touch bar under On the line — Fabric bubble; tap or hold-and-drag.
 * Keeps sheet `applied.approval` in sync (Any | Approved | Not approved).
 */
export function OrdersApprovalChips({ value, onChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<OrdersApprovalFilter, ChipLayout>>>(
    {},
  );

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

  const onChipLayout = useCallback((name: OrdersApprovalFilter, e: LayoutChangeEvent) => {
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
    backgroundColor: interpolateColor(hoverIndex.value, [0, 1, 2], [...fills]),
    borderColor: interpolateColor(hoverIndex.value, [0, 1, 2], [...borders]),
  }));

  const shellH = SHELL_PAD_Y * 2 + PILL_HEIGHT;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          height: shellH,
          borderRadius: shellH / 2,
          backgroundColor: dark ? 'rgba(42,36,37,0.92)' : colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.borderStrong,
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
          const label = t(`mobile.orders.filterApprovalOptions.${chip}`);
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
                flex: 1,
                height: PILL_HEIGHT,
                paddingHorizontal: 6,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
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
                  lineHeight: 16,
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
