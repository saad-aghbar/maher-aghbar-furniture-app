import { useCallback, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { localeRow, useLocale } from '@/i18n';
import { useDraggablePillBar, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

/** Admin Orders desk — Sales Orders vs Customer Requests inbox. */
export type AdminOrdersDeskMode = 'orders' | 'requests';

const MODES: AdminOrdersDeskMode[] = ['orders', 'requests'];

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 6;
const PILL_HEIGHT = 34;

const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

const FILL_LIGHT = ['#E8EEEA', '#F2E8E4'] as const;
const BORDER_LIGHT = ['#4A6B58', '#7A4538'] as const;
const FILL_DARK = ['rgba(122,170,148,0.18)', 'rgba(196,137,122,0.18)'] as const;
const BORDER_DARK = ['#7AAA94', '#C4897A'] as const;

type ChipLayout = { x: number; width: number };

type Props = {
  value: AdminOrdersDeskMode;
  onChange: (next: AdminOrdersDeskMode) => void;
  ordersCount?: number;
  requestsCount?: number;
};

/**
 * Primary Admin Orders desk switch — not approval language.
 * Orders = confirmed Sales Orders (Order Journey). Requests = RFQ inbox.
 */
export function AdminOrdersDeskSwitch({
  value,
  onChange,
  ordersCount,
  requestsCount,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<AdminOrdersDeskMode, ChipLayout>>>(
    {},
  );

  const activeIdx = Math.max(0, MODES.indexOf(value));
  const dark = colorScheme === 'dark';
  const wood = colors.brandSoft;
  const fills = [wood, wood, wood];
  const borders = [colors.brand, colors.brand, colors.brandActive];

  const orderedLayouts = useMemo(
    () => MODES.map((mode) => layouts[mode]),
    [layouts],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = MODES[index];
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

  const onChipLayout = useCallback((name: AdminOrdersDeskMode, e: LayoutChangeEvent) => {
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
    backgroundColor: interpolateColor(hoverIndex.value, [0, 1], [...fills]),
    borderColor: interpolateColor(hoverIndex.value, [0, 1], [...borders]),
  }));

  const shellH = SHELL_PAD_Y * 2 + PILL_HEIGHT;

  const labelFor = (mode: AdminOrdersDeskMode) => {
    if (mode === 'requests') {
      const journey = t('mobile.orders.journey.rfq.label');
      if (journey !== 'mobile.orders.journey.rfq.label') {
        const count = requestsCount;
        return count == null ? journey : `${journey} · ${count}`;
      }
    }
    const base = t(`mobile.orders.deskMode.${mode}`);
    const count = mode === 'orders' ? ordersCount : requestsCount;
    if (count == null) return base;
    return `${base} · ${count}`;
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          flexDirection: localeRow(isRTL),
          alignItems: 'center',
          height: shellH,
          borderRadius: shellH / 2,
          backgroundColor: dark
            ? value === 'requests'
              ? 'rgba(196,137,122,0.12)'
              : 'rgba(42,36,37,0.92)'
            : value === 'requests'
              ? colors.warningSoft
              : colors.surfaceSecondary,
          borderWidth: value === 'requests' ? 1.5 : 1,
          borderColor: value === 'requests' ? colors.warning : colors.borderStrong,
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

        {MODES.map((mode) => {
          const focused = value === mode;
          const label = labelFor(mode);
          const ink = focused
            ? mode === 'orders'
              ? colors.success
              : colors.warning
            : colors.textSecondary;

          return (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onLayout={(e) => onChipLayout(mode, e)}
              onPress={() => {
                if (mode === value) return;
                onChange(mode);
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
