import { useCallback, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { RequestPriority } from '@/api/modules/requests';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics, useDraggablePillBar, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

const PRIORITIES: RequestPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 6;
const PILL_HEIGHT = 34;
const CHIP_PAD_X = 10;
const CHIP_MIN_WIDTH = 48;

const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

/** Soft fills — Low / Normal / High / Urgent (same as production PriorityTouchBar). */
const FILL_LIGHT = ['#E8EBEF', '#F3EEE5', '#F5EDE3', '#F2E8E4'] as const;
const BORDER_LIGHT = ['#6B7280', '#8F7A58', '#B45309', '#7A4538'] as const;
const FILL_DARK = [
  'rgba(148,163,184,0.18)',
  'rgba(168,144,108,0.18)',
  'rgba(217,119,6,0.20)',
  'rgba(196,137,122,0.18)',
] as const;
const BORDER_DARK = ['#94A3B8', '#A8906C', '#F59E0B', '#C4897A'] as const;

type ChipLayout = { x: number; width: number };

type Props = {
  value: RequestPriority;
  onChange: (next: RequestPriority) => void;
  disabled?: boolean;
};

function priorityIndex(value: string): number {
  const i = PRIORITIES.indexOf(value as RequestPriority);
  return i >= 0 ? i : 1;
}

function inkFor(
  p: RequestPriority,
  colors: {
    textMuted: string;
    textSecondary: string;
    brand: string;
    warning: string;
    error: string;
  },
  focused: boolean,
): string {
  if (!focused) return colors.textMuted;
  if (p === 'LOW') return colors.textSecondary;
  if (p === 'NORMAL') return colors.brand;
  if (p === 'HIGH') return colors.warning;
  return colors.error;
}

/**
 * New Order priority — same Fabric-bubble touch bar as production PriorityTouchBar.
 */
export function NewOrderPriorityBar({ value, onChange, disabled }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, colorScheme, theme } = useTheme();
  const reduce = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<RequestPriority, ChipLayout>>>(
    {},
  );

  const activeIdx = priorityIndex(value);
  const active = PRIORITIES[activeIdx] ?? 'NORMAL';
  const dark = colorScheme === 'dark';
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;

  const orderedLayouts = useMemo(
    () => PRIORITIES.map((p) => layouts[p]),
    [layouts],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      if (disabled) return;
      const next = PRIORITIES[index];
      if (!next || next === value) return;
      void haptics.selection();
      onChange(next);
    },
    [disabled, onChange, value],
  );

  const { pillX, pillW, dragging, hoverIndex, gesture } = useDraggablePillBar({
    layouts: orderedLayouts,
    activeIndex: activeIdx,
    onSelectIndex,
    reduceMotion: reduce,
    enabled: !disabled,
    spring: BUBBLE_SPRING,
  });

  const onChipLayout = useCallback((name: RequestPriority, e: LayoutChangeEvent) => {
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
      { scale: 1 + dragging.value * 0.05 },
    ],
    width: pillW.value,
    backgroundColor: interpolateColor(
      hoverIndex.value,
      [0, 1, 2, 3],
      [...fills],
    ),
    borderColor: interpolateColor(hoverIndex.value, [0, 1, 2, 3], [...borders]),
  }));

  const shellH = SHELL_PAD_Y * 2 + PILL_HEIGHT;

  return (
    <View style={{ gap: theme.spacing.sm, opacity: disabled ? 0.55 : 1 }}>
      <AppText variant="label" color="secondary">
        {t('mobile.newOrder.priority')}
      </AppText>
      <GestureDetector gesture={gesture}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: shellH,
            borderRadius: shellH / 2,
            backgroundColor: dark ? 'rgba(42,36,37,0.92)' : colors.surface,
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
                shadowOpacity: dark ? 0.25 : 0.1,
                shadowRadius: 4,
                elevation: 2,
              },
              pillStyle,
            ]}
          />

          {PRIORITIES.map((p) => {
            const focused = active === p;
            const display = t(`mobile.newOrder.priorities.${p}`);
            const ink = inkFor(p, colors, focused);

            return (
              <Pressable
                key={p}
                accessibilityRole="radio"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={display}
                disabled={disabled}
                onLayout={(e) => onChipLayout(p, e)}
                onPress={() => {
                  if (disabled || p === value) return;
                  void haptics.selection();
                  onChange(p);
                }}
                style={{
                  flex: 1,
                  height: PILL_HEIGHT,
                  minWidth: CHIP_MIN_WIDTH,
                  paddingHorizontal: CHIP_PAD_X,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                <AppText
                  variant="caption"
                  weight={
                    focused
                      ? locale === 'ar'
                        ? 'medium'
                        : 'semibold'
                      : 'medium'
                  }
                  numberOfLines={1}
                  align="center"
                  style={{
                    color: ink,
                    fontSize: 12,
                    lineHeight: 15,
                    opacity: focused ? 1 : 0.78,
                  }}
                >
                  {display}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}
