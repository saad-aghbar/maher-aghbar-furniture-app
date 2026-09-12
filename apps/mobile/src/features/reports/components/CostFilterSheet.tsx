import { ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { COST_STATUS_OPTIONS, type CostFilterState } from '../costFilters';

type Props = {
  open: boolean;
  onClose: () => void;
  value: CostFilterState;
  onChange: (next: CostFilterState) => void;
  onApply: () => void;
  onReset: () => void;
  onPickDealer: () => void;
  dealerLabel: string;
  productLabel: string | null;
};

export function CostFilterSheet({
  open,
  onClose,
  value,
  onChange,
  onApply,
  onReset,
  onPickDealer,
  dealerLabel,
  productLabel,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pill = {
    borderRadius: theme.radius.full,
    minHeight: theme.sizes.touch.min,
    paddingVertical: 0,
  } as const;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.reports.filterTitle')}
      fitContent
      maxHeight={520}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
      >
        <DealerBoard title={t('mobile.reports.filterDealer')} titleWeight={titleWeight}>
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.reports.filterDealer')}
            onPress={() => {
              void haptics.selection();
              onPickDealer();
            }}
            style={{
              minHeight: 48,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: value.customerId ? colors.brand : colors.border,
              backgroundColor: value.customerId ? colors.brandSoft : colors.surfaceSecondary,
              paddingHorizontal: theme.spacing.md,
              justifyContent: 'center',
            }}
          >
            <AppText weight={titleWeight}>{dealerLabel}</AppText>
          </AnimatedPressable>
        </DealerBoard>

        <DealerBoard title={t('mobile.reports.filterProduct')} titleWeight={titleWeight}>
          {productLabel && value.productId ? (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('accounting.allProducts')}
              onPress={() => {
                void haptics.selection();
                onChange({ ...value, productId: null });
              }}
              style={{
                minHeight: 48,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.brand,
                backgroundColor: colors.brandSoft,
                paddingHorizontal: theme.spacing.md,
                justifyContent: 'center',
              }}
            >
              <AppText weight={titleWeight}>{productLabel}</AppText>
              <AppText variant="caption" color="muted">
                {t('accounting.allProducts')}
              </AppText>
            </AnimatedPressable>
          ) : (
            <AppText variant="caption" color="muted">
              {t('accounting.allProducts')}
            </AppText>
          )}
        </DealerBoard>

        <DealerBoard title={t('mobile.reports.filterStatus')} titleWeight={titleWeight}>
          <View style={{ gap: theme.spacing.sm }}>
            <StatusChip
              label={t('mobile.reports.allStatuses')}
              selected={!value.status}
              onPress={() => onChange({ ...value, status: null })}
            />
            {COST_STATUS_OPTIONS.map((status) => (
              <StatusChip
                key={status}
                label={status.replace(/_/g, ' ')}
                selected={value.status === status}
                onPress={() => onChange({ ...value, status })}
              />
            ))}
          </View>
        </DealerBoard>
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.reports.filterHint')}
        </AppText>
        <PrimaryButton
          label={t('accounting.filterApply')}
          style={pill}
          onPress={() => {
            onApply();
            onClose();
          }}
        />
        <SecondaryButton
          label={t('accounting.filterReset')}
          style={pill}
          onPress={() => {
            onReset();
            onClose();
          }}
        />
      </ScrollView>
    </BottomSheet>
  );
}

function StatusChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 40,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.border,
        backgroundColor: selected ? colors.brandSoft : colors.surface,
        paddingHorizontal: theme.spacing.md,
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {selected ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: colors.brand,
            ...(isRTL ? { right: 0 } : { left: 0 }),
          }}
        />
      ) : null}
      <AppText variant="label" weight={selected ? 'semibold' : 'medium'}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
