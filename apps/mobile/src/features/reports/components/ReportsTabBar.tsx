import { useCallback, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics, useDraggablePillBar, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { ReportsCategory } from '../selectReports';

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 6;
const PILL_HEIGHT = 40;
const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

const FILL_LIGHT = ['#F3EEE5', '#EEEAE4', '#F2E8E4'] as const;
const BORDER_LIGHT = ['#8F7A58', '#6E6254', '#7A4538'] as const;
const FILL_DARK = [
  'rgba(168,144,108,0.22)',
  'rgba(181,164,140,0.20)',
  'rgba(196,137,122,0.18)',
] as const;
const BORDER_DARK = ['#A8906C', '#B5A48C', '#C4897A'] as const;

const TAB_ICON: Record<ReportsCategory, keyof typeof Ionicons.glyphMap> = {
  dashboard: 'grid-outline',
  sales: 'briefcase-outline',
  production: 'construct-outline',
  financial: 'cash-outline',
};

type TabItem = {
  key: ReportsCategory;
  label: string;
};

type ChipLayout = { x: number; width: number };

type Props = {
  tabs: TabItem[];
  value: ReportsCategory;
  onChange: (next: ReportsCategory) => void;
};

/**
 * Draggable reports section bar — Snapshot / Sales / Floor / Books with sliding bubble.
 */
export function ReportsTabBar({ tabs, value, onChange }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const shellH = SHELL_PAD_Y * 2 + PILL_HEIGHT;

  const [layouts, setLayouts] = useState<Partial<Record<ReportsCategory, ChipLayout>>>({});

  const visible = useMemo(() => tabs.filter((x) => Boolean(x.key)), [tabs]);
  const activeIdx = Math.max(
    0,
    visible.findIndex((x) => x.key === value),
  );

  const orderedLayouts = useMemo(
    () => visible.map((item) => layouts[item.key]),
    [layouts, visible],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = visible[index];
      if (!next || next.key === value) return;
      void haptics.selection();
      onChange(next.key);
    },
    [onChange, value, visible],
  );

  const { pillX, pillW, dragging, hoverIndex, gesture } = useDraggablePillBar({
    layouts: orderedLayouts,
    activeIndex: activeIdx,
    onSelectIndex,
    reduceMotion: reduce,
    enabled: visible.length > 1,
    spring: BUBBLE_SPRING,
  });

  const onChipLayout = useCallback((name: ReportsCategory, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[name];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [name]: { x, width } };
    });
  }, []);

  const colorStops = useMemo(() => {
    if (visible.length <= 1) return { input: [0], fill: [fills[0]], border: [borders[0]] };
    const input = visible.map((_, i) => i);
    const fill = visible.map((_, i) => fills[Math.min(i, fills.length - 1)]!);
    const border = visible.map((_, i) => borders[Math.min(i, fills.length - 1)]!);
    return { input, fill, border };
  }, [borders, fills, visible]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }, { scale: 1 + dragging.value * 0.04 }],
    width: pillW.value,
    backgroundColor: interpolateColor(
      hoverIndex.value,
      colorStops.input,
      colorStops.fill as unknown as string[],
    ),
    borderColor: interpolateColor(
      hoverIndex.value,
      colorStops.input,
      colorStops.border as unknown as string[],
    ),
  }));

  if (visible.length === 0) return null;

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        padding: theme.spacing.sm,
        ...orderBoardShadow(colorScheme),
      }}
    >
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
          {visible.map((item) => {
            const focused = value === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={item.label}
                onLayout={(e) => onChipLayout(item.key, e)}
                onPress={() => {
                  if (item.key === value) return;
                  void haptics.selection();
                  onChange(item.key);
                }}
                style={{
                  flex: 1,
                  height: PILL_HEIGHT,
                  paddingHorizontal: 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                  gap: 1,
                }}
              >
                <Ionicons
                  name={TAB_ICON[item.key]}
                  size={14}
                  color={focused ? colors.brand : colors.textSecondary}
                />
                <AppText
                  variant="caption"
                  weight={focused ? titleWeight : 'medium'}
                  numberOfLines={1}
                  align="center"
                  style={{
                    color: focused ? colors.brand : colors.textSecondary,
                    fontSize: 11,
                    lineHeight: 13,
                    opacity: focused ? 1 : 0.88,
                  }}
                >
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}
