import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  hint?: string;
  error?: string | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * Floor form shell for inventory sheets — hint + error + elevated field board.
 */
export function InventorySheetBody({ children, hint, error, style }: Props) {
  const { colors, theme, colorScheme } = useTheme();

  return (
    <View style={[{ flex: 1, gap: theme.spacing.md }, style]}>
      {hint ? (
        <AppText variant="caption" color="muted">
          {hint}
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="caption" color="error">
          {error}
        </AppText>
      ) : null}
      <View
        style={{
          flex: 1,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: theme.spacing.md,
            padding: theme.spacing.md,
            paddingBottom: theme.spacing.lg,
          }}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

type SectionLabelProps = {
  label: string;
};

export function InventorySheetSectionLabel({ label }: SectionLabelProps) {
  const { locale, isRTL } = useLocale();
  const { colors } = useTheme();

  return (
    <AppText
      variant="caption"
      color="muted"
      weight={locale === 'ar' ? 'regular' : 'medium'}
      style={{
        letterSpacing: locale === 'ar' ? 0 : 0.6,
        textTransform: locale === 'ar' ? 'none' : 'uppercase',
        fontSize: 11,
        lineHeight: 14,
        textAlign: isRTL ? 'right' : 'left',
        color: colors.textMuted,
      }}
    >
      {label}
    </AppText>
  );
}
