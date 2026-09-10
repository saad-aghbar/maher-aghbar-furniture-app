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
import type { InvoicePurchasingKind } from '../invoiceFilters';

const KINDS: InvoicePurchasingKind[] = ['FABRIC', 'RAW'];
const SHELL_PAD_Y = 6;
const SHELL_PAD_X = 6;
const PILL_HEIGHT = 36;
const BUBBLE_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;
const FILL_LIGHT = ['#F3EEE5', '#EEEAE4'] as const;
const BORDER_LIGHT = ['#8F7A58', '#6E6254'] as const;
const FILL_DARK = ['rgba(168,144,108,0.22)', 'rgba(181,164,140,0.20)'] as const;
const BORDER_DARK = ['#A8906C', '#B5A48C'] as const;

type ChipLayout = { x: number; width: number };

type Props = {
  value: InvoicePurchasingKind;
  onChange: (kind: InvoicePurchasingKind) => void;
};

export function InvoicePurchasingRail({ value, onChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = colorScheme === 'dark';
  const fills = dark ? FILL_DARK : FILL_LIGHT;
  const borders = dark ? BORDER_DARK : BORDER_LIGHT;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [layouts, setLayouts] = useState<Partial<Record<InvoicePurchasingKind, ChipLayout>>>({});
  const activeIdx = Math.max(0, KINDS.indexOf(value));
  const orderedLayouts = useMemo(() => KINDS.map((kind) => layouts[kind]), [layouts]);

  const onSelectIndex = useCallback(
    (index: number) => {
      const next = KINDS[index];
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

  const onChipLayout = useCallback((name: InvoicePurchasingKind, e: LayoutChangeEvent) => {
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
        {KINDS.map((kind) => {
          const focused = value === kind;
          const label = t(`mobile.invoices.purchasingKind.${kind === 'FABRIC' ? 'fabric' : 'raw'}`);
          return (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onLayout={(e) => onChipLayout(kind, e)}
              onPress={() => {
                if (kind === value) return;
                void haptics.selection();
                onChange(kind);
              }}
              style={{
                flex: 1,
                height: PILL_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
              }}
            >
              <AppText
                variant="caption"
                weight={focused ? titleWeight : 'medium'}
                numberOfLines={1}
                align="center"
                style={{
                  color: focused ? colors.brand : colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 16,
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
