import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function DealerEmptyState({ title, body, actionLabel, onAction }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        padding: theme.spacing.xl,
        alignItems: isRTL ? 'flex-end' : 'center',
        gap: theme.spacing.md,
      }}
    >
      <AppText
        variant="heading"
        weight={titleWeight}
        align={isRTL ? 'end' : 'center'}
        style={{ color: colors.textPrimary }}
      >
        {title}
      </AppText>
      {body ? (
        <AppText variant="body" color="secondary" align={isRTL ? 'end' : 'center'}>
          {body}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <PrimaryButton
          label={actionLabel}
          onPress={onAction}
          style={{ borderRadius: theme.radius.xl, alignSelf: 'stretch' }}
        />
      ) : null}
    </View>
  );
}
