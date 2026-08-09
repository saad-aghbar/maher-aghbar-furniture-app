import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  title?: string;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accent?: boolean;
  /** Override brand edge accent (e.g. overdue error). */
  accentColor?: string;
  /** Quieter section — secondary header strip. */
  quiet?: boolean;
};

/** Parchment floor board for invoice list/detail sections. */
export function InvoiceFloorBoard({
  children,
  title,
  trailing,
  style,
  contentStyle,
  accent = true,
  accentColor,
  quiet = false,
}: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const edge = accentColor ?? colors.brand;

  return (
    <View
      style={[
        {
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        },
        style,
      ]}
    >
      {accent ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: edge,
            opacity: accentColor ? 0.9 : 0.55,
          }}
        />
      ) : null}
      {title || trailing ? (
        <View
          style={{
            paddingTop: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.sm,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + (accent ? 4 : 0) }
              : { paddingLeft: theme.spacing.lg + (accent ? 4 : 0) }),
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: quiet ? colors.surfaceSecondary : undefined,
          }}
        >
          {title ? (
            <AppText
              variant={quiet ? 'label' : 'heading'}
              weight={titleWeight}
              style={{
                flex: 1,
                textAlign: isRTL ? 'right' : 'left',
                fontSize: quiet ? 13 : undefined,
                color: quiet ? colors.textSecondary : colors.textPrimary,
              }}
            >
              {title}
            </AppText>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {trailing}
        </View>
      ) : null}
      <View
        style={[
          {
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + (accent ? 4 : 0) }
              : { paddingLeft: theme.spacing.lg + (accent ? 4 : 0) }),
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
