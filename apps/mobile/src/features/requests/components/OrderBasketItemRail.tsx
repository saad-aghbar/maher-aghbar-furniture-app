import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { NewOrderLine } from '../newOrderLine';

type Props = {
  lines: NewOrderLine[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

export function OrderBasketItemRail({ lines, activeId, onSelect }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (!lines.length) return null;

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
          backgroundColor: colors.brand,
          opacity: 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText variant="label" weight={titleWeight} style={{ fontSize: 15 }}>
          {t('mobile.newOrder.basket')}
        </AppText>
      </View>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        {lines.map((line, index) => {
          const active = line.id === activeId;
          const label =
            line.customProductName.trim() ||
            line.variantLabel.trim() ||
            t('mobile.newOrder.untitledModel');
          return (
            <AnimatedPressable
              key={line.id}
              variant="button"
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              testID={`order-item-rail-${line.id}`}
              onPress={() => {
                void haptics.selection();
                onSelect(line.id);
              }}
              style={{
                flexGrow: 1,
                minWidth: lines.length === 1 ? '100%' : '42%',
                minHeight: theme.sizes.touch.min,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.borderStrong,
                backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                overflow: 'hidden',
                justifyContent: 'center',
              }}
            >
              {active ? (
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
              <AppText weight={titleWeight} numberOfLines={1} color={active ? 'brand' : undefined}>
                {index + 1}. {label}
              </AppText>
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {line.variantLabel || t('mobile.newOrder.defaultVariant')} · ×{line.quantity}
              </AppText>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}
