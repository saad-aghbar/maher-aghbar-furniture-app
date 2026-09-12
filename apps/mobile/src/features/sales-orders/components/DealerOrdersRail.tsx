import { useCallback, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics, useDraggablePillBar, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { DealerOrdersRailKey } from '../selectDealerOrders';

const LABEL_KEY: Record<DealerOrdersRailKey, string> = {
  all: 'mobile.orders.railAll',
  drafts: 'mobile.orders.chips.drafts',
  waiting: 'mobile.orders.chips.waiting',
  needsInformation: 'mobile.orders.chips.needsInformation',
  pending: 'mobile.orders.chips.pending',
  production: 'mobile.orders.chips.production',
  ready: 'mobile.orders.chips.ready',
  shipped: 'mobile.orders.chips.shipped',
};

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 6;
const PILL_HEIGHT = 36;
const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

/** Same wood stops as returns — slice to 3 or 4. */
const FILL_LIGHT = ['#F5F1EA', '#F3EDE3', '#E9EBE3', '#F2E8E4'] as const;
const BORDER_LIGHT = ['#C4BDB0', '#8B7049', '#5A6348', '#7A4538'] as const;
const FILL_DARK = [
  'rgba(168,144,108,0.22)',
  'rgba(196,160,106,0.20)',
  'rgba(154,170,122,0.18)',
  'rgba(196,137,122,0.18)',
] as const;
const BORDER_DARK = ['#A8906C', '#C4A06A', '#9AAA7A', '#C4897A'] as const;

type ChipLayout = { x: number; width: number };

type Props = {
  segments: DealerOrdersRailKey[];
  value: DealerOrdersRailKey;
  onChange: (next: DealerOrdersRailKey) => void;
};

/** Desk subsections — equal-flex wood bar, no scroll. */
export function DealerOrdersRail({ segments, value, onChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';
  const n = Math.max(2, Math.min(4, segments.length));
  const fills = (dark ? FILL_DARK : FILL_LIGHT).slice(0, n);
  const borders = (dark ? BORDER_DARK : BORDER_LIGHT).slice(0, n);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [layouts, setLayouts] = useState<Partial<Record<DealerOrdersRailKey, ChipLayout>>>({});
  const safeValue = segments.includes(value) ? value : 'all';
  const activeIdx = Math.max(0, segments.indexOf(safeValue));

  const orderedLayouts = useMemo(
    () => segments.map((segment) => layouts[segment]),
    [layouts, segments],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = segments[index];
      if (!next || next === value) return;
      void haptics.selection();
      onChange(next);
    },
    [onChange, segments, value],
  );

  const { pillX, pillW, dragging, hoverIndex, gesture } = useDraggablePillBar({
    layouts: orderedLayouts,
    activeIndex: activeIdx,
    onSelectIndex,
    reduceMotion: reduce,
    enabled: segments.length > 0,
    spring: BUBBLE_SPRING,
  });

  const onChipLayout = useCallback((name: DealerOrdersRailKey, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[name];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [name]: { x, width } };
    });
  }, []);

  const fourStop = n === 4;
  const fill0 = fills[0] ?? FILL_LIGHT[0];
  const fill1 = fills[1] ?? FILL_LIGHT[1];
  const fill2 = fills[2] ?? FILL_LIGHT[2];
  const fill3 = fills[3] ?? FILL_LIGHT[3];
  const border0 = borders[0] ?? BORDER_LIGHT[0];
  const border1 = borders[1] ?? BORDER_LIGHT[1];
  const border2 = borders[2] ?? BORDER_LIGHT[2];
  const border3 = borders[3] ?? BORDER_LIGHT[3];

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pillX.value },
      { scale: 1 + dragging.value * 0.04 },
    ],
    width: pillW.value,
    backgroundColor: fourStop
      ? interpolateColor(hoverIndex.value, [0, 1, 2, 3], [fill0, fill1, fill2, fill3])
      : interpolateColor(hoverIndex.value, [0, 1, 2], [fill0, fill1, fill2]),
    borderColor: fourStop
      ? interpolateColor(hoverIndex.value, [0, 1, 2, 3], [border0, border1, border2, border3])
      : interpolateColor(hoverIndex.value, [0, 1, 2], [border0, border1, border2]),
  }));

  const shellH = SHELL_PAD_Y * 2 + PILL_HEIGHT;

  if (segments.length === 0) return null;

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
        {segments.map((segment) => {
          const focused = segment === safeValue;
          const label = t(LABEL_KEY[segment]);
          return (
            <Pressable
              key={segment}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onLayout={(e) => onChipLayout(segment, e)}
              onPress={() => onSelectIndex(segments.indexOf(segment))}
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
