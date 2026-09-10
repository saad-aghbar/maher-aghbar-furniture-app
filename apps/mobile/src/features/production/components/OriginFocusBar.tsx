import { useCallback, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { rowDirection } from '@/i18n/rtl';
import { haptics, useDraggablePillBar, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

export type OriginFocus = 'all' | 'normal' | 'returned';

const ORIGINS: OriginFocus[] = ['all', 'normal', 'returned'];

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
  value: OriginFocus;
  onChange: (next: OriginFocus) => void;
  /** Inner track inside a floor board — no extra shell shadow. */
  embedded?: boolean;
};

export function nextOriginFocus(_current: OriginFocus, tapped: OriginFocus): OriginFocus {
  return tapped;
}

export function originFocusToParam(
  value: OriginFocus,
): 'normal' | 'returned' | undefined {
  return value === 'all' ? undefined : value;
}

/** Three-cell All / Normal / Returned pill — All is explicit, no tap-to-clear. */
export function OriginFocusBar({ value, onChange, embedded }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<OriginFocus, ChipLayout>>>({});
  const dark = colorScheme === 'dark';
  const activeIdx = Math.max(0, ORIGINS.indexOf(value));
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;

  const orderedLayouts = useMemo(
    () => ORIGINS.map((origin) => layouts[origin]),
    [layouts],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = ORIGINS[index];
      if (!next || next === value) return;
      void haptics.selection();
      onChange(nextOriginFocus(value, next));
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

  const onChipLayout = useCallback((name: OriginFocus, e: LayoutChangeEvent) => {
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
    backgroundColor: interpolateColor(hoverIndex.value, [0, 1, 2], [...fills]),
    borderColor: interpolateColor(hoverIndex.value, [0, 1, 2], [...borders]),
  }));

  const shellH = SHELL_PAD_Y * 2 + PILL_HEIGHT;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          flexDirection: rowDirection(isRTL),
          alignItems: 'center',
          height: shellH,
          borderRadius: shellH / 2,
          backgroundColor: dark ? 'rgba(42,36,37,0.92)' : colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          paddingVertical: SHELL_PAD_Y,
          paddingHorizontal: SHELL_PAD_X,
          shadowColor: dark ? '#000000' : '#1E1A1B',
          shadowOffset: { width: 0, height: embedded ? 0 : 2 },
          shadowOpacity: embedded ? 0 : dark ? 0.22 : 0.07,
          shadowRadius: embedded ? 0 : 8,
          elevation: embedded ? 0 : 2,
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
        {ORIGINS.map((origin) => {
          const focused = value === origin;
          const label = t(`mobile.production.origin.${origin}`);
          return (
            <Pressable
              key={origin}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onLayout={(e) => onChipLayout(origin, e)}
              onPress={() => onSelectIndex(ORIGINS.indexOf(origin))}
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
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={{
                  color: focused ? colors.brand : colors.textSecondary,
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
