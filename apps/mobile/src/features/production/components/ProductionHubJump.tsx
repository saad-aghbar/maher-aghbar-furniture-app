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

export type ProductionHubSection =
  | 'overview'
  | 'materials'
  | 'wip'
  | 'tasks'
  | 'workflow';

type Props = {
  active: ProductionHubSection;
  onChange: (section: ProductionHubSection) => void;
  /** Preparing plan desk — Tasks / Workflow / Materials / WIP. */
  planMode?: boolean;
};

const ALL_SECTIONS: ProductionHubSection[] = ['overview', 'materials', 'wip', 'tasks'];
const PLAN_SECTIONS: ProductionHubSection[] = ['tasks', 'workflow', 'materials', 'wip'];

const LABEL_KEY: Record<ProductionHubSection, string> = {
  overview: 'mobile.production.hubJumpOverview',
  materials: 'mobile.production.hubJumpMaterials',
  wip: 'mobile.production.hubJumpWip',
  tasks: 'mobile.production.hubJumpTasks',
  workflow: 'mobile.production.hubJumpWorkflow',
};

const TAB_ICON: Record<ProductionHubSection, keyof typeof Ionicons.glyphMap> = {
  overview: 'grid-outline',
  materials: 'cube-outline',
  wip: 'layers-outline',
  tasks: 'list-outline',
  workflow: 'git-branch-outline',
};

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 6;
const PILL_HEIGHT = 40;
const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

const FILL_LIGHT = ['#F3EEE5', '#EEEAE4', '#F2E8E4', '#E9EBE3'] as const;
const BORDER_LIGHT = ['#8F7A58', '#6E6254', '#7A4538', '#5A6348'] as const;
const FILL_DARK = [
  'rgba(168,144,108,0.22)',
  'rgba(181,164,140,0.20)',
  'rgba(196,137,122,0.18)',
  'rgba(154,170,122,0.18)',
] as const;
const BORDER_DARK = ['#A8906C', '#B5A48C', '#C4897A', '#9AAA7A'] as const;

type ChipLayout = { x: number; width: number };

/**
 * Production detail section bar — Overview / Materials / WIP / Tasks, or
 * plan desk Tasks / Workflow / Materials / WIP with sliding wood bubble.
 */
export function ProductionHubJump({ active, onChange, planMode = false }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const shellH = SHELL_PAD_Y * 2 + PILL_HEIGHT;
  const SECTIONS = planMode ? PLAN_SECTIONS : ALL_SECTIONS;

  const [layouts, setLayouts] = useState<Partial<Record<ProductionHubSection, ChipLayout>>>(
    {},
  );

  const activeIdx = Math.max(0, SECTIONS.indexOf(active));
  const orderedLayouts = useMemo(
    () => SECTIONS.map((section) => layouts[section]),
    [SECTIONS, layouts],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = SECTIONS[index];
      if (!next || next === active) return;
      void haptics.selection();
      onChange(next);
    },
    [SECTIONS, active, onChange],
  );

  const { pillX, pillW, dragging, hoverIndex, gesture } = useDraggablePillBar({
    layouts: orderedLayouts,
    activeIndex: activeIdx,
    onSelectIndex,
    reduceMotion: reduce,
    enabled: true,
    spring: BUBBLE_SPRING,
  });

  const onChipLayout = useCallback((name: ProductionHubSection, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[name];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [name]: { x, width } };
    });
  }, []);

  const colorStops = useMemo(() => {
    const input = SECTIONS.map((_, i) => i);
    return { input, fill: [...fills], border: [...borders] };
  }, [borders, fills]);

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
              },
              pillStyle,
            ]}
          />
          {SECTIONS.map((section) => {
            const focused = active === section;
            const label = t(LABEL_KEY[section]);
            return (
              <Pressable
                key={section}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                onLayout={(e) => onChipLayout(section, e)}
                onPress={() => {
                  if (section === active) return;
                  void haptics.selection();
                  onChange(section);
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
                  name={TAB_ICON[section]}
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
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}
