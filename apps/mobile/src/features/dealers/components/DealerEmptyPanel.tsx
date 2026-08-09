import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  text: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Tighter padding when nested inside a DealerBoard. */
  compact?: boolean;
  /** Inside an existing board — no second frame, just icon + copy. */
  nested?: boolean;
};

/**
 * Full-width empty panel for dealer summary / CRM — floor board, not a stray pill.
 */
export function DealerEmptyPanel({
  text,
  icon = 'file-tray-outline',
  compact = false,
  nested = false,
}: Props) {
  const { locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        alignSelf: 'stretch',
        borderRadius: nested ? 0 : theme.radius.xl,
        borderWidth: nested ? 0 : 1,
        borderColor: colors.borderStrong,
        backgroundColor: nested ? 'transparent' : colors.surface,
        paddingVertical: compact || nested ? theme.spacing.lg : theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg,
        alignItems: 'center',
        gap: theme.spacing.sm + 2,
        ...(nested ? null : orderBoardShadow(colorScheme)),
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brandSoft,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={icon} size={18} color={colors.brand} />
      </View>

      <AppText
        variant="caption"
        weight={titleWeight}
        style={{
          textAlign: 'center',
          color: colors.textSecondary,
          fontSize: 12,
          lineHeight: 17,
          letterSpacing: locale === 'ar' ? 0 : 0.2,
          maxWidth: 260,
        }}
      >
        {text}
      </AppText>
    </View>
  );
}
