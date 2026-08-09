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
import type { ProductionListBucket } from '../api';

const CHIPS = ['all', 'in_production', 'late', 'completed'] as const;
type ChipKey = (typeof CHIPS)[number];

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 8;
const PILL_HEIGHT = 34;
const CHIP_PAD_X = 14;
const CHIP_MIN_WIDTH = 52;

const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

const FILL_LIGHT = ['#F3EEE5', '#EEEAE4', '#F2E8E4', '#E9EBE3'] as const;
const BORDER_LIGHT = ['#8F7A58', '#6E6254', '#7A4538', '#5A6348'] as const;
const FILL_DARK = [
  'rgba(168,144,108,0.18)',
  'rgba(181,164,140,0.20)',
  'rgba(196,137,122,0.18)',
  'rgba(154,170,122,0.18)',
] as const;
const BORDER_DARK = ['#A8906C', '#B5A48C', '#C4897A', '#9AAA7A'] as const;

type ChipLayout = { x: number; width: number };

type ProductionFilterChipsProps = {
  value: ProductionListBucket;
  onChange: (next: ProductionListBucket) => void;
};

function isChipKey(value: ProductionListBucket): value is ChipKey {
  return (CHIPS as readonly string[]).includes(value);
}

function chipIndex(value: ProductionListBucket): number {
  if (!isChipKey(value)) return -1;
  return CHIPS.indexOf(value);
}

function accentFor(
  chip: ChipKey,
  colors: {
    brand: string;
    info: string;
    error: string;
    success: string;
    textSecondary: string;
  },
  focused: boolean,
): string {
  if (!focused) return colors.textSecondary;
  if (chip === 'in_production') return colors.info;
  if (chip === 'late') return colors.error;
  if (chip === 'completed') return colors.success;
  return colors.brand;
}

/**
 * Full-width filter bar — even chips, text-hugging Fabric bubble.
 * Tap to select, or press-and-hold then drag to scrub the bubble.
 */
export function ProductionFilterChips({ value, onChange }: ProductionFilterChipsProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<ChipKey, ChipLayout>>>({});

  const active = isChipKey(value) ? value : null;
  const activeIdx = Math.max(0, chipIndex(value));
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
    enabled: active != null,
    spring: BUBBLE_SPRING,
  });

  const onChipLayout = useCallback((name: ChipKey, e: LayoutChangeEvent) => {
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
    opacity: active != null ? 1 : 0,
    backgroundColor: interpolateColor(
      hoverIndex.value,
      [0, 1, 2, 3],
      [...fills],
    ),
    borderColor: interpolateColor(hoverIndex.value, [0, 1, 2, 3], [...borders]),
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
          const focused = active === chip;
          const label = t(`mobile.production.chips.${chip}`);
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
                  fontSize: 13,
                  lineHeight: 16,
                  opacity: focused || active == null ? 1 : 0.82,
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
