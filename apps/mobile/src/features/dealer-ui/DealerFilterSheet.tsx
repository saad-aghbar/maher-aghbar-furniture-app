import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AnimatedPressable, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

export type DealerFilterOption = {
  id: string;
  label: string;
};

type Props = {
  title: string;
  options: DealerFilterOption[];
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  clearLabel?: string;
  applyLabel?: string;
};

/** Lightweight filter sheet body — pair with existing ActionSheet / BottomSheet host. */
export function DealerFilterSheet({
  title,
  options,
  selectedId,
  onSelect,
  onClose,
  clearLabel,
  applyLabel,
}: Props) {
  const { isRTL, locale, t } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
      <AppText
        variant="heading"
        weight={titleWeight}
        style={{ textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }}
      >
        {title}
      </AppText>
      <View style={{ gap: theme.spacing.xs }}>
        {options.map((opt) => {
          const selected = opt.id === selectedId;
          return (
            <AnimatedPressable
              key={opt.id}
              onPress={() => {
                void haptics.selection();
                onSelect(opt.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                minHeight: 44,
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radius.lg,
                backgroundColor: selected ? colors.brandSoft : colors.surface,
                borderWidth: 1,
                borderColor: selected ? colors.brand : colors.border,
                justifyContent: 'center',
                alignItems: isRTL ? 'flex-end' : 'flex-start',
              }}
            >
              <AppText
                variant="body"
                weight={selected ? titleWeight : 'regular'}
                style={{ color: colors.textPrimary }}
              >
                {opt.label}
              </AppText>
            </AnimatedPressable>
          );
        })}
      </View>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
        <SecondaryButton
          label={clearLabel ?? t('mobile.dealerUi.clear')}
          onPress={() => onSelect(null)}
          style={{ flex: 1, borderRadius: theme.radius.xl }}
        />
        <PrimaryButton
          label={applyLabel ?? t('mobile.dealerUi.apply')}
          onPress={onClose}
          style={{ flex: 1, borderRadius: theme.radius.xl }}
        />
      </View>
    </View>
  );
}
