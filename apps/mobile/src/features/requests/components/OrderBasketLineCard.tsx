import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { NewOrderQtyStepper } from './NewOrderQtyStepper';
import { isCustomCatalogProduct } from '../newOrderProductKind';
import type { NewOrderLine } from '../newOrderLine';

type Props = {
  line: NewOrderLine;
  index: number;
  onChange: (next: NewOrderLine) => void;
  onRemove: () => void;
  onEditSpec: () => void;
};

export function OrderBasketLineCard({
  line,
  index,
  onChange,
  onRemove,
  onEditSpec,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const custom = isCustomCatalogProduct(line.productId, line.customProductName);
  const title =
    line.customProductName.trim() ||
    line.variantLabel.trim() ||
    t('mobile.newOrder.untitledModel');

  return (
    <DealerBoard
      title={`${index + 1}. ${title}`}
      titleWeight={titleWeight}
      accentColor={custom ? colors.warning : colors.brand}
      trailing={
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.newOrder.removeLine')}
          testID={`order-basket-remove-${line.id}`}
          onPress={() => {
            void haptics.selection();
            onRemove();
          }}
          style={{ minHeight: theme.sizes.touch.min, justifyContent: 'center' }}
        >
          <AppText variant="caption" color="error">
            {t('mobile.newOrder.removeLine')}
          </AppText>
        </AnimatedPressable>
      }
    >
      <View style={{ gap: theme.spacing.md }}>
        {!line.productId.trim() ? (
          <TextField
            label={t('mobile.newOrder.modelName')}
            value={line.customProductName}
            onChangeText={(value) => onChange({ ...line, customProductName: value, productId: '' })}
            placeholder={t('mobile.newOrder.modelNamePlaceholder')}
          />
        ) : (
          <AppText variant="caption" color="muted">
            {line.variantLabel || t('mobile.newOrder.defaultVariant')}
          </AppText>
        )}

        <NewOrderQtyStepper
          value={line.quantity}
          onChange={(quantity) => onChange({ ...line, quantity })}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.newOrder.editLineSpec')}
            testID={`order-basket-spec-${line.id}`}
            onPress={() => {
              void haptics.selection();
              onEditSpec();
            }}
            style={{
              flex: 1,
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              paddingHorizontal: theme.spacing.md,
              justifyContent: 'center',
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <AppText weight={titleWeight}>{t('mobile.newOrder.editLineSpec')}</AppText>
          </AnimatedPressable>
        </View>
      </View>
    </DealerBoard>
  );
}
