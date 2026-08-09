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

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 6;
const PILL_HEIGHT = 36;

const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

const FILL_LIGHT = ['#F3EEE5', '#EEEAE4', '#F2E8E4', '#E9EBE3', '#E8EEEA'] as const;
const BORDER_LIGHT = ['#8F7A58', '#6E6254', '#7A4538', '#5A6348', '#4A6B58'] as const;
const FILL_DARK = [
  'rgba(168,144,108,0.22)',
  'rgba(181,164,140,0.20)',
  'rgba(196,137,122,0.18)',
  'rgba(154,170,122,0.18)',
  'rgba(122,170,148,0.18)',
] as const;
const BORDER_DARK = ['#A8906C', '#B5A48C', '#C4897A', '#9AAA7A', '#7AAA94'] as const;

export type RoleTouchOption = {
  id: string;
  label: string;
};

type ChipLayout = { x: number; width: number };

type Props = {
  roles: RoleTouchOption[];
  value: string;
  onChange: (roleId: string) => void;
};

/**
 * Roles touch bar — Fabric bubble for Customer / Worker / Admin (and any extras).
 */
export function RolesTouchBar({ roles, value, onChange }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [layouts, setLayouts] = useState<Partial<Record<string, ChipLayout>>>({});

  const activeIdx = Math.max(
    0,
    roles.findIndex((r) => r.id === value),
  );

  const orderedLayouts = useMemo(
    () => roles.map((role) => layouts[role.id]),
    [layouts, roles],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = roles[index];
      if (!next || next.id === value) return;
      void haptics.selection();
      onChange(next.id);
    },
    [onChange, roles, value],
  );

  const { pillX, pillW, dragging, hoverIndex, gesture } = useDraggablePillBar({
    layouts: orderedLayouts,
    activeIndex: activeIdx,
    onSelectIndex,
    reduceMotion: reduce,
    enabled: roles.length > 1,
    spring: BUBBLE_SPRING,
  });

  const onChipLayout = useCallback((id: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[id];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [id]: { x, width } };
    });
  }, []);

  const colorStops = useMemo(() => {
    if (roles.length <= 1) {
      return { input: [0], fill: [fills[0]!], border: [borders[0]!] };
    }
    const input = roles.map((_, i) => i);
    const fill = roles.map((_, i) => fills[Math.min(i, fills.length - 1)]!);
    const border = roles.map((_, i) => borders[Math.min(i, borders.length - 1)]!);
    return { input, fill, border };
  }, [borders, fills, roles]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pillX.value },
      { scale: 1 + dragging.value * 0.04 },
    ],
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

  if (roles.length === 0) return null;

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

        {roles.map((role) => {
          const focused = value === role.id;
          return (
            <Pressable
              key={role.id}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={role.label}
              onLayout={(e) => onChipLayout(role.id, e)}
              onPress={() => {
                if (role.id === value) return;
                void haptics.selection();
                onChange(role.id);
              }}
              style={{
                flex: 1,
                height: PILL_HEIGHT,
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
                {role.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </GestureDetector>
  );
}
