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
import { type InventoryLifecycle } from '../preferWarehouseForReceive';

export type { InventoryLifecycle };

const LIFECYCLES: InventoryLifecycle[] = ['materials', 'semiFinished', 'finished'];

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 6;
const PILL_HEIGHT = 34;
const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

const FILL_LIGHT = ['#F3EEE5', '#EEEAE4', '#E9EBE3'] as const;
const BORDER_LIGHT = ['#8F7A58', '#6E6254', '#5A6348'] as const;
const FILL_DARK = [
  'rgba(168,144,108,0.22)',
  'rgba(181,164,140,0.20)',
  'rgba(154,170,122,0.18)',
] as const;
const BORDER_DARK = ['#A8906C', '#B5A48C', '#9AAA7A'] as const;

type ChipLayout = { x: number; width: number };

type Props = {
  active: InventoryLifecycle;
  onChange: (lifecycle: InventoryLifecycle) => void;
};

function accentFor(
  lifecycle: InventoryLifecycle,
  colors: { brand: string; info: string; success: string; textSecondary: string },
  focused: boolean,
): string {
  if (!focused) return colors.textSecondary;
  if (lifecycle === 'semiFinished') return colors.info;
  if (lifecycle === 'finished') return colors.success;
  return colors.brand;
}

/** Warehouse-type switcher — same pill language as floor section tabs. */
export function InventoryLifecycleTabs({ active, onChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<InventoryLifecycle, ChipLayout>>>({});

  const activeIdx = Math.max(0, LIFECYCLES.indexOf(active));
  const dark = colorScheme === 'dark';
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;

  const orderedLayouts = useMemo(
    () => LIFECYCLES.map((lifecycle) => layouts[lifecycle]),
    [layouts],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = LIFECYCLES[index];
      if (!next || next === active) return;
      onChange(next);
    },
    [onChange, active],
  );

  const { pillX, pillW, dragging, hoverIndex, gesture } = useDraggablePillBar({
    layouts: orderedLayouts,
    activeIndex: activeIdx,
    onSelectIndex,
    reduceMotion: reduce,
    enabled: true,
    spring: BUBBLE_SPRING,
  });

  const onChipLayout = useCallback((name: InventoryLifecycle, e: LayoutChangeEvent) => {
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

        {LIFECYCLES.map((lifecycle) => {
          const focused = active === lifecycle;
          const label = t(`mobile.inventory.lifecycle.${lifecycle}`);
          const ink = accentFor(lifecycle, colors, focused);

          return (
            <Pressable
              key={lifecycle}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onLayout={(e) => onChipLayout(lifecycle, e)}
              onPress={() => {
                if (lifecycle === active) return;
                onChange(lifecycle);
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
                weight={focused ? (locale === 'ar' ? 'medium' : 'semibold') : 'medium'}
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
