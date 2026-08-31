import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Divider } from '@/components/layout/Divider';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

export type ReportMoneyRow = {
  key: string;
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'error';
};

type Props = {
  rows: ReportMoneyRow[];
};

/** Inset money ledger — label start, amount opposite edge. */
export function ReportsMoneyRows({ rows }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}
    >
      {rows.map((row, index) => {
        const color =
          row.tone === 'error'
            ? colors.error
            : row.tone === 'warning'
              ? colors.warning
              : colors.textPrimary;
        return (
          <View key={row.key}>
            {index > 0 ? <Divider compact plain style={{ marginVertical: 0 }} /> : null}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.md,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm + 2,
              }}
            >
              <AppText
                variant="caption"
                color="muted"
                style={{
                  flex: 1,
                  textAlign: isRTL ? 'right' : 'left',
                  fontSize: 11,
                }}
              >
                {row.label}
              </AppText>
              <AppText
                weight={titleWeight}
                dir="ltr"
                style={{
                  color,
                  fontSize: 15,
                  textAlign: isRTL ? 'left' : 'right',
                }}
              >
                {row.value}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}
