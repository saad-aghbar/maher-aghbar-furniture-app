import { useCallback, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics, useDraggablePillBar, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { CompletedDatePreset } from './CompletedTasksFilters';

export const COMPLETED_DATE_PRESETS: CompletedDatePreset[] = [
  'all',
  'today',
  'week',
  'custom',
];

const LABEL_KEY: Record<CompletedDatePreset, string> = {
  all: 'mobile.tasks.completedDateAll',
  today: 'mobile.tasks.completedDateToday',
  week: 'mobile.tasks.completedDateWeek',
  custom: 'mobile.tasks.completedDateCustom',
};

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 5;
const PILL_HEIGHT = 36;

const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

/** Warm industrial stops — all → today → week → pick day. */
const FILL_LIGHT = ['#F3EEE5', '#F0EBE3', '#EDE8DF', '#F2E8E4'] as const;
const BORDER_LIGHT = ['#8F7A58', '#7A6A52', '#6E634F', '#7A4538'] as const;
const FILL_DARK = [
  'rgba(168,144,108,0.22)',
  'rgba(181,164,140,0.20)',
  'rgba(168,156,132,0.18)',
  'rgba(196,137,122,0.18)',
] as const;
const BORDER_DARK = ['#A8906C', '#B5A48C', '#A89A82', '#C4897A'] as const;

type ChipLayout = { x: number; width: number };

type Props = {
  value: CompletedDatePreset;
  onChange: (preset: CompletedDatePreset) => void;
};

/**
 * Completed-date touch bar — Fabric bubble; tap or hold-and-scrub.
 * Pick day selects the preset; the calendar opens from the button below.
 */
export function CompletedDateRail({ value, onChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [layouts, setLayouts] = useState<
    Partial<Record<CompletedDatePreset, ChipLayout>>
  >({});

  const activeIdx = Math.max(0, COMPLETED_DATE_PRESETS.indexOf(value));

  const orderedLayouts = useMemo(
    () => COMPLETED_DATE_PRESETS.map((preset) => layouts[preset]),
    [layouts],
  );

  const selectPreset = useCallback(
    (preset: CompletedDatePreset) => {
      if (preset === value) return;
      void haptics.selection();
      onChange(preset);
    },
    [onChange, value],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = COMPLETED_DATE_PRESETS[index];
      if (!next) return;
      selectPreset(next);
    },
    [selectPreset],
  );

  const { pillX, pillW, dragging, hoverIndex, gesture } = useDraggablePillBar({
    layouts: orderedLayouts,
    activeIndex: activeIdx,
    onSelectIndex,
    reduceMotion: reduce,
    enabled: true,
    spring: BUBBLE_SPRING,
  });

  const onChipLayout = useCallback(
    (name: CompletedDatePreset, e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      setLayouts((prev) => {
        const cur = prev[name];
        if (cur && cur.x === x && cur.width === width) return prev;
        return { ...prev, [name]: { x, width } };
      });
    },
    [],
  );

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pillX.value },
      { scale: 1 + dragging.value * 0.04 },
    ],
    width: pillW.value,
    backgroundColor: interpolateColor(
      hoverIndex.value,
      [0, 1, 2, 3],
      [...fills],
    ),
    borderColor: interpolateColor(
      hoverIndex.value,
      [0, 1, 2, 3],
      [...borders],
    ),
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

        {COMPLETED_DATE_PRESETS.map((preset) => {
          const focused = value === preset;
          const label = t(LABEL_KEY[preset]);

          return (
            <Pressable
              key={preset}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onLayout={(e) => onChipLayout(preset, e)}
              onPress={() => selectPreset(preset)}
              style={{
                flex: 1,
                height: PILL_HEIGHT,
                paddingHorizontal: 2,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
              }}
            >
              <AppText
                variant="caption"
                weight={focused ? titleWeight : 'medium'}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.68}
                align="center"
                style={{
                  color: focused ? colors.brand : colors.textSecondary,
                  fontSize: 11,
                  lineHeight: 14,
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
