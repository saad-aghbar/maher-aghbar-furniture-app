import { useCallback, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import type { ProductionProblemStatus } from '@/api/modules/production';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics, useDraggablePillBar, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

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

const TABS: ProductionProblemStatus[] = ['open', 'answered', 'all'];

const TAB_ICON: Record<ProductionProblemStatus, keyof typeof Ionicons.glyphMap> = {
  open: 'alert-circle-outline',
  answered: 'checkmark-circle-outline',
  all: 'file-tray-outline',
};

const LABEL_KEY: Record<ProductionProblemStatus, string> = {
  open: 'mobile.tasks.problemsStatusOpen',
  answered: 'mobile.tasks.problemsStatusAnswered',
  all: 'mobile.tasks.problemsStatusAll',
};

type ChipLayout = { x: number; width: number };

type Props = {
  value: ProductionProblemStatus;
  onChange: (status: ProductionProblemStatus) => void;
  openCount?: number;
};

/**
 * Factory inbox chrome — header band + 40px wood-bubble Open / Answered / All.
 */
export function ProductionProblemsTouchBar({ value, onChange, openCount }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const shellH = SHELL_PAD_Y * 2 + PILL_HEIGHT;
  const waiting = (openCount ?? 0) > 0;

  const [layouts, setLayouts] = useState<Partial<Record<ProductionProblemStatus, ChipLayout>>>(
    {},
  );

  const activeIdx = Math.max(0, TABS.indexOf(value));

  const orderedLayouts = useMemo(
    () => TABS.map((tab) => layouts[tab]),
    [layouts],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = TABS[index];
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

  const onChipLayout = useCallback((name: ProductionProblemStatus, e: LayoutChangeEvent) => {
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
    backgroundColor: interpolateColor(hoverIndex.value, [0, 1, 2], [...fills]),
    borderColor: interpolateColor(hoverIndex.value, [0, 1, 2], [...borders]),
  }));

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: waiting ? colors.error : colors.brand,
          opacity: waiting ? 0.9 : 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: waiting ? colors.errorSoft : colors.surface,
            borderWidth: 1,
            borderColor: waiting ? colors.error : colors.border,
          }}
        >
          <Ionicons
            name={waiting ? 'warning-outline' : 'file-tray-outline'}
            size={14}
            color={waiting ? colors.error : colors.brand}
          />
        </View>
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            flex: 1,
            fontSize: 11,
            color: colors.brand,
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.tasks.problemsEyebrow')}
        </AppText>
        {openCount != null ? (
          <AppText
            variant="caption"
            weight={titleWeight}
            dir="ltr"
            style={{
              color: waiting ? colors.error : colors.textMuted,
              fontSize: 11,
            }}
          >
            {t('mobile.tasks.problemsOpenCount', { count: openCount })}
          </AppText>
        ) : null}
      </View>

      <View
        style={{
          padding: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.sm + 4 }
            : { paddingLeft: theme.spacing.sm + 4 }),
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
            {TABS.map((tab) => {
              const focused = value === tab;
              const label = t(LABEL_KEY[tab]);
              const count = tab === 'open' ? openCount : undefined;
              const a11y = count != null ? `${label} (${count})` : label;
              return (
                <Pressable
                  key={tab}
                  accessibilityRole="button"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={a11y}
                  onLayout={(e) => onChipLayout(tab, e)}
                  onPress={() => {
                    if (tab === value) return;
                    void haptics.selection();
                    onChange(tab);
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
                    name={TAB_ICON[tab]}
                    size={14}
                    color={focused ? colors.brand : colors.textSecondary}
                  />
                  <AppText
                    variant="caption"
                    weight={focused ? titleWeight : 'medium'}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                    align="center"
                    style={{
                      color: focused ? colors.brand : colors.textSecondary,
                      fontSize: 11,
                      lineHeight: 13,
                      opacity: focused ? 1 : 0.88,
                    }}
                  >
                    {count != null ? `${label} (${count})` : label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}
