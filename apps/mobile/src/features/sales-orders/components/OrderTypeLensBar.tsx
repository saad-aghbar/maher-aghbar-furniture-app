import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { honestJourneyCount } from '../honestJourneyCount';

export type OrderTypeFocus = 'all' | 'standard' | 'modified' | 'custom';

export const ORDER_TYPE_LENS_CELLS: Array<Exclude<OrderTypeFocus, 'all'>> = [
  'standard',
  'modified',
  'custom',
];

export type OrderTypeCounts = {
  standard: number;
  modified: number;
  custom: number;
};

export function nextOrderTypeFocus(
  current: OrderTypeFocus,
  tapped: Exclude<OrderTypeFocus, 'all'>,
): OrderTypeFocus {
  return current === tapped ? 'all' : tapped;
}

type Props = {
  value: OrderTypeFocus;
  counts?: OrderTypeCounts | null;
  onChange: (next: OrderTypeFocus) => void;
};

/**
 * Standard / Modified / Custom lens — three equal parchment cells.
 * Orthogonal to Order Journey / Factory Review. Compact, not giant tabs.
 */
export function OrderTypeLensBar({ value, counts, onChange }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
      }}
    >
      {ORDER_TYPE_LENS_CELLS.map((key) => {
        const selected = value === key;
        const label = t(`mobile.orders.journey.kind.${key}`);
        const count = counts?.[key] ?? 0;
        return (
          <AnimatedPressable
            key={key}
            variant="button"
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label} ${count}`}
            onPress={() => {
              const next = nextOrderTypeFocus(value, key);
              if (next === value) return;
              void haptics.selection();
              onChange(next);
            }}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 52,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: selected ? colors.brand : colors.borderStrong,
              backgroundColor: selected ? colors.brandSoft : colors.surface,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.xs,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              ...orderBoardShadow(colorScheme),
            }}
          >
            {selected ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 3,
                  backgroundColor: colors.brand,
                }}
              />
            ) : null}
            <AppText
              variant="title"
              weight={titleWeight}
              align="center"
              dir="ltr"
              style={{
                color: selected ? colors.brand : colors.textPrimary,
                fontSize: 18,
                lineHeight: 22,
                letterSpacing: -0.3,
                fontVariant: ['tabular-nums'],
              }}
            >
              {honestJourneyCount(count)}
            </AppText>
            <AppText
              variant="caption"
              align="center"
              numberOfLines={1}
              style={{
                color: selected ? colors.brand : colors.textMuted,
                fontSize: 10,
                lineHeight: 12,
                letterSpacing: locale === 'ar' ? 0 : 0.4,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
              }}
            >
              {label}
            </AppText>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}
