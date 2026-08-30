import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { localeRow, useLocale } from '@/i18n';
import { useDraggablePillBar, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

export type StatusChipKey =
  | 'all'
  | 'drafts'
  | 'waiting'
  | 'needsInformation'
  | 'pending'
  | 'production'
  | 'ready'
  | 'shipped'
  | 'delivered';

type OrdersFilterChipsProps = {
  value: StatusChipKey;
  onChange: (value: StatusChipKey) => void;
  /** Override visible chips — dealer lifecycle uses a shorter set. */
  chips?: StatusChipKey[];
};

export const DEALER_LIFECYCLE_CHIPS: StatusChipKey[] = [
  'all',
  'drafts',
  'waiting',
  'needsInformation',
  'production',
  'ready',
  'shipped',
  'delivered',
];

const CHIPS: StatusChipKey[] = [
  'all',
  'drafts',
  'waiting',
  'needsInformation',
  'pending',
  'production',
  'ready',
  'shipped',
  'delivered',
];

const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 6;
const PILL_HEIGHT = 34;
const CHIP_PAD_X = 14;
const CHIP_MIN_WIDTH = 44;
const CHIP_GAP = 2;

const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

const FILL_LIGHT = [
  '#F3EEE5',
  '#EEE8E0',
  '#EEEAE4',
  '#F2E8E4',
  '#E9EBE3',
  '#F0E6DC',
  '#E8EEEA',
  '#EDE8E2',
  '#F1E9E4',
] as const;
const BORDER_LIGHT = [
  '#8F7A58',
  '#7A6B52',
  '#6E6254',
  '#7A4538',
  '#5A6348',
  '#8A5A40',
  '#4A6B58',
  '#7A6A50',
  '#6B5A48',
] as const;
const FILL_DARK = [
  'rgba(168,144,108,0.18)',
  'rgba(168,148,120,0.20)',
  'rgba(181,164,140,0.20)',
  'rgba(196,137,122,0.18)',
  'rgba(154,170,122,0.18)',
  'rgba(196,150,110,0.20)',
  'rgba(122,170,148,0.18)',
  'rgba(168,148,120,0.18)',
  'rgba(181,150,130,0.18)',
] as const;
const BORDER_DARK = [
  '#A8906C',
  '#A89878',
  '#B5A48C',
  '#C4897A',
  '#9AAA7A',
  '#C49A72',
  '#7AAA94',
  '#A8906C',
  '#B5A48C',
] as const;

type ChipLayout = { x: number; width: number };

function chipIcon(chip: StatusChipKey): keyof typeof Ionicons.glyphMap {
  switch (chip) {
    case 'production':
      return 'construct-outline';
    case 'ready':
      return 'cube-outline';
    case 'shipped':
      return 'car-outline';
    case 'delivered':
      return 'checkmark-done-outline';
    case 'drafts':
      return 'document-outline';
    case 'waiting':
      return 'hourglass-outline';
    case 'needsInformation':
      return 'alert-circle-outline';
    case 'pending':
      return 'time-outline';
    default:
      return 'list-outline';
  }
}

function accentFor(
  colors: { textPrimary: string; textSecondary: string },
  focused: boolean,
): string {
  if (!focused) return colors.textSecondary;
  if (chip === 'drafts') return colors.brand;
  if (chip === 'waiting') return colors.info;
  if (chip === 'needsInformation') return colors.warning;
  if (chip === 'pending') return colors.warning;
  if (chip === 'production') return colors.info;
  if (chip === 'ready') return colors.brand;
  if (chip === 'shipped') return colors.warning;
  if (chip === 'delivered') return colors.success;
  return colors.brand;
}

/** Human phase labels — lifecycle-first for commercial-safe dealer chips. */
function dealerChipLabel(
  chip: StatusChipKey,
  t: (key: string) => string,
): string {
  const lifecycleKey: Partial<Record<StatusChipKey, string>> = {
    all: 'lifecycle.tabs.all',
    drafts: 'lifecycle.tabs.draft',
    waiting: 'lifecycle.tabs.waiting',
    needsInformation: 'lifecycle.tabs.needsInformation',
    pending: 'lifecycle.tabs.pending',
    production: 'lifecycle.tabs.inProduction',
    ready: 'lifecycle.readyForDelivery',
    shipped: 'lifecycle.shipped',
    delivered: 'lifecycle.tabs.delivered',
  };
  const key = lifecycleKey[chip];
  if (key) {
    const v = t(key);
    if (!v.startsWith('lifecycle.')) return v;
  }
  return t(`mobile.orders.chips.${chip}`);
}

export function OrdersFilterChips({ value, onChange, chips = CHIPS }: OrdersFilterChipsProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const [layouts, setLayouts] = useState<Partial<Record<StatusChipKey, ChipLayout>>>({});
  const [viewportW, setViewportW] = useState(0);

  const activeIdx = Math.max(0, chips.indexOf(value));
  const dark = colorScheme === 'dark';
  const wood = colors.brandSoft;
  const fills = [wood, wood, wood, wood, wood, wood] as const;
  const borders = [
    colors.brand,
    colors.brand,
    colors.brand,
    colors.brandActive,
    colors.brand,
    colors.brand,
  ] as const;

  const orderedLayouts = useMemo(
    () => chips.map((chip) => layouts[chip]),
    [chips, layouts],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = chips[index];
      if (!next || next === value) return;
      onChange(next);
    },
    [chips, onChange, value],
  );

  const { pillX, pillW, dragging, hoverIndex, gesture } = useDraggablePillBar({
    layouts: orderedLayouts,
    activeIndex: activeIdx,
    onSelectIndex,
    reduceMotion: reduce,
    enabled: true,
    spring: BUBBLE_SPRING,
  });

  const onChipLayout = useCallback((name: StatusChipKey, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[name];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [name]: { x, width } };
    });
  }, []);

  useEffect(() => {
    const layout = layouts[value];
    if (!layout || viewportW <= 0) return;
    const pad = SHELL_PAD_X;
    const target = Math.max(0, layout.x - (viewportW - layout.width) / 2 + pad);
    scrollRef.current?.scrollTo({ x: target, animated: true });
  }, [value, layouts, viewportW, isRTL]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pillX.value },
      { scale: 1 + dragging.value * 0.04 },
    ],
    width: pillW.value,
    backgroundColor: interpolateColor(
      hoverIndex.value,
      [0, 1, 2, 3, 4, 5, 6],
      [...fills],
    ),
    borderColor: interpolateColor(
      hoverIndex.value,
      [0, 1, 2, 3, 4, 5, 6],
      [...borders],
    ),
  }));

  const shellH = SHELL_PAD_Y * 2 + PILL_HEIGHT;

  return (
    <View
      onLayout={(e) => setViewportW(e.nativeEvent.layout.width)}
      style={{
        height: shellH,
        borderRadius: shellH / 2,
        backgroundColor: dark ? 'rgba(42,36,37,0.92)' : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        shadowColor: dark ? '#000000' : '#1E1A1B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: dark ? 0.22 : 0.07,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingVertical: SHELL_PAD_Y,
          paddingHorizontal: SHELL_PAD_X,
        }}
      >
        <GestureDetector gesture={gesture}>
          <View
            style={{
              flexDirection: localeRow(isRTL),
              alignItems: 'center',
              gap: CHIP_GAP,
              minHeight: PILL_HEIGHT,
              flexGrow: 1,
            }}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: 0,
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

            {chips.map((chip) => {
              const focused = value === chip;
              const label = dealerChipLabel(chip, t);
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
                    flexShrink: 0,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: 4,
                  }}
                >
                  <Ionicons name={chipIcon(chip)} size={13} color={ink} />
                  <AppText
                    variant="caption"
                    weight={
                      focused ? (locale === 'ar' ? 'medium' : 'semibold') : 'medium'
                    }
                    numberOfLines={1}
                    align="center"
                    style={{
                      color: ink,
                      fontSize: 13,
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
      </ScrollView>
    </View>
  );
}
