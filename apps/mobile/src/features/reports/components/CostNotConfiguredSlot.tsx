import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  hint: string;
};

/** Named slot for labor / variants / group-by-option until later phases fill them. */
export function CostNotConfiguredSlot({ title, hint }: Props) {
  const { locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <DealerBoard title={title} titleWeight={titleWeight} accentColor={colors.textMuted}>
      <View
        style={{
          borderRadius: theme.radius.lg,
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          padding: theme.spacing.md,
        }}
      >
        <AppText
          variant="body"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {hint}
        </AppText>
      </View>
    </DealerBoard>
  );
}
