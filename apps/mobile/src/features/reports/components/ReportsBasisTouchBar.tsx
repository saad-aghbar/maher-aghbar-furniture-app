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
import { useChromeSize, useTheme } from '@/theme';
import type { CostDateBasis } from '../reportsPeriod';

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 6;
const PILL_HEIGHT = 36;
const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

const FILL_LIGHT = ['#F3EEE5', '#EEEAE4', '#F2E8E4'] as const;
const BORDER_LIGHT = ['#8F7A58', '#6E6254', '#7A4538'] as const;
const FILL_DARK = [
  'rgba(168,144,108,0.22)',
  'rgba(181,164,140,0.20)',
  'rgba(196,137,122,0.18)',
] as const;
const BORDER_DARK = ['#A8906C', '#B5A48C', '#C4897A'] as const;

const BASIS: CostDateBasis[] = ['delivered', 'activity', 'orderDate'];

const BASIS_SHORT: Record<CostDateBasis, string> = {
  delivered: 'mobile.reports.basisDeliveredShort',
  activity: 'mobile.reports.basisActivityShort',
  orderDate: 'mobile.reports.basisOrderDateShort',
};

const BASIS_FULL: Record<CostDateBasis, string> = {
  delivered: 'mobile.reports.basisDelivered',
  activity: 'mobile.reports.basisActivity',
  orderDate: 'mobile.reports.basisOrderDate',
};

type ChipLayout = { x: number; width: number };

type Props = {
  value: CostDateBasis;
  onChange: (next: CostDateBasis) => void;
};

/**
 * Delivered / Activity / Order date — inner wood bubble, same family as purchasing/roles.
 */
export function ReportsBasisTouchBar({ value, onChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [layouts, setLayouts] = useState<Partial<Record<CostDateBasis, ChipLayout>>>({});

  const activeIdx = Math.max(0, BASIS.findIndex((item) => item === value));
  const orderedLayouts = useMemo(() => BASIS.map((item) => layouts[item]), [layouts]);

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = BASIS[index];
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

  const onChipLayout = useCallback((id: CostDateBasis, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[id];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [id]: { x, width } };
    });
  }, []);

  const colorStops = useMemo(() => {
    const input = BASIS.map((_, i) => i);
    const fill = BASIS.map((_, i) => fills[Math.min(i, fills.length - 1)]!);
    const border = BASIS.map((_, i) => borders[Math.min(i, borders.length - 1)]!);
    return { input, fill, border };
  }, [borders, fills]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }, { scale: 1 + dragging.value * 0.04 }],
    width: pillW.value,
    backgroundColor: interpolateColor(hoverIndex.value, colorStops.input, colorStops.fill as unknown as string[]),
    borderColor: interpolateColor(hoverIndex.value, colorStops.input, colorStops.border as unknown as string[]),
  }));

  const pillH = useChromeSize(PILL_HEIGHT);
  const shellH = SHELL_PAD_Y * 2 + pillH;

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
              height: pillH,
              left: 0,
              borderRadius: pillH / 2,
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
        {BASIS.map((item) => {
          const focused = value === item;
          const short = t(BASIS_SHORT[item]);
          const full = t(BASIS_FULL[item]);
          return (
            <Pressable
              key={item}
              testID={`cost-basis-${item}`}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={full}
              onLayout={(e) => onChipLayout(item, e)}
              onPress={() => {
                if (item === value) return;
                void haptics.selection();
                onChange(item);
              }}
              style={{
                flex: 1,
                height: pillH,
                paddingHorizontal: 4,
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
                minimumFontScale={0.78}
                align="center"
                style={{
                  color: focused ? colors.brand : colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 16,
                  opacity: focused ? 1 : 0.82,
                }}
              >
                {short}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </GestureDetector>
  );
}
