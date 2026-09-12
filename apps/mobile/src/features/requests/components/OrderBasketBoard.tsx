import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { CostPressableRow } from '@/features/reports/components/CostPressableRow';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { NewOrderLine } from '../newOrderLine';

type Props = {
  lines: NewOrderLine[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onEditSpec: (id: string) => void;
};

export function OrderBasketBoard({
  lines,
  activeId,
  onSelect,
  onRemove,
  onAdd,
  onEditSpec,
}: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <DealerBoard title={t('mobile.newOrder.basket')} titleWeight={titleWeight}>
      {lines.length ? (
        <View style={{ gap: theme.spacing.sm }}>
          {lines.map((line, index) => {
            const label =
              line.customProductName ||
              line.variantLabel ||
              t('mobile.newOrder.untitledModel');
            const selected = line.id === activeId;
            return (
              <View key={line.id} style={{ gap: theme.spacing.xs }}>
                <CostPressableRow
                  testID={`order-basket-${line.id}`}
                  accessibilityLabel={label}
                  onPress={() => {
                    onSelect(line.id);
                    onEditSpec(line.id);
                  }}
                >
                  <AppText weight={titleWeight} color={selected ? 'brand' : undefined}>
                    {index + 1}. {label}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {line.variantLabel || t('mobile.newOrder.defaultVariant')} · ×{line.quantity}
                  </AppText>
                </CostPressableRow>
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('mobile.newOrder.removeLine')}
                  testID={`order-basket-remove-${line.id}`}
                  onPress={() => {
                    void haptics.selection();
                    onRemove(line.id);
                  }}
                  style={{ paddingHorizontal: theme.spacing.md }}
                >
                  <AppText variant="caption" color="error">
                    {t('mobile.newOrder.removeLine')}
                  </AppText>
                </AnimatedPressable>
              </View>
            );
          })}
        </View>
      ) : (
        <DealerEmptyPanel nested compact text={t('mobile.newOrder.basketEmpty')} />
      )}
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.newOrder.addLine')}
        testID="order-basket-add"
        onPress={() => {
          void haptics.selection();
          onAdd();
        }}
        style={{
          minHeight: theme.sizes.touch.min,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          paddingHorizontal: theme.spacing.md,
          justifyContent: 'center',
          marginTop: theme.spacing.sm,
        }}
      >
        <AppText weight={titleWeight}>{t('mobile.newOrder.addLine')}</AppText>
      </AnimatedPressable>
    </DealerBoard>
  );
}
