import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useTheme } from '@/theme';

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  const { colors, theme } = useTheme();

  return (
    <View
      accessibilityRole="summary"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing['2xl'],
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <View
        style={{
          width: '100%',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing['2xl'],
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.card,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandSoft,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="file-tray-outline" size={22} color={colors.brand} />
        </View>
        <AppText variant="heading" align="center">
          {title}
        </AppText>
        {description ? (
          <AppText variant="bodySecondary" color="secondary" align="center">
            {description}
          </AppText>
        ) : null}
        {actionLabel && onAction ? (
          <PrimaryButton label={actionLabel} onPress={onAction} style={{ marginTop: theme.spacing.sm, alignSelf: 'stretch' }} />
        ) : null}
      </View>
    </View>
  );
}
