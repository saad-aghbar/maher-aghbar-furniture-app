import { useCallback, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics, useDraggablePillBar, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

export type DealerScheduleSegment = 'upcoming' | 'calendar';

const SEGMENTS: DealerScheduleSegment[] = ['upcoming', 'calendar'];

const LABEL_KEY: Record<DealerScheduleSegment, string> = {
  upcoming: 'mobile.orders.modeUpcoming',
  calendar: 'mobile.orders.modeCalendar',
};

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 6;
const PILL_HEIGHT = 36;
const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

/** First two stops of the returns wood set. */
const FILL_LIGHT = ['#F5F1EA', '#F3EDE3'] as const;
const BORDER_LIGHT = ['#C4BDB0', '#8B7049'] as const;
const FILL_DARK = ['rgba(168,144,108,0.22)', 'rgba(196,160,106,0.20)'] as const;
const BORDER_DARK = ['#A8906C', '#C4A06A'] as const;

type ChipLayout = { x: number; width: number };

type Props = {
  value: DealerScheduleSegment;
  onChange: (next: DealerScheduleSegment) => void;
};

/** Upcoming | Calendar wood bubble for the dealer delivery desk. */
export function DealerScheduleRail({ value, onChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [layouts, setLayouts] = useState<Partial<Record<DealerScheduleSegment, ChipLayout>>>({});
  const activeIdx = Math.max(0, SEGMENTS.indexOf(value));

  const orderedLayouts = useMemo(
    () => SEGMENTS.map((segment) => layouts[segment]),
    [layouts],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = SEGMENTS[index];
      if (!next || next === value) return;
      void haptics.selection();
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

  const onChipLayout = useCallback((name: DealerScheduleSegment, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[name];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [name]: { x, width } };
    });
  }, []);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }, { scale: 1 + dragging.value * 0.04 }],
    width: pillW.value,
    backgroundColor: interpolateColor(hoverIndex.value, [0, 1], [...fills]),
    borderColor: interpolateColor(hoverIndex.value, [0, 1], [...borders]),
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

        {SEGMENTS.map((segment) => {
          const focused = segment === value;
          const label = t(LABEL_KEY[segment]);
          return (
            <Pressable
              key={segment}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onLayout={(e) => onChipLayout(segment, e)}
              onPress={() => {
                if (segment === value) return;
                void haptics.selection();
                onChange(segment);
              }}
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
                minimumFontScale={0.65}
                align="center"
                style={{
                  color: focused ? colors.textPrimary : colors.textSecondary,
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
