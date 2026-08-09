import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Invoice } from '@/api/modules/invoices';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { DealerEmptyPanel } from './DealerEmptyPanel';

type Props = {
  invoices: Invoice[];
  emptyLabel: string;
  onPressInvoice: (id: string) => void;
};

const LIST_MAX_H = 320;

/**
 * Scrollable invoices ledger for dealer summary — capped height, floor-row aesthetic.
 */
export function DealerInvoicesList({ invoices, emptyLabel, onPressInvoice }: Props) {
  const { t, formatCurrency, formatDate, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (invoices.length === 0) {
    return <DealerEmptyPanel text={emptyLabel} icon="receipt-outline" nested />;
  }

  return (
    <View>
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText
          variant="caption"
          color="muted"
          weight={titleWeight}
          style={{
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontSize: 11,
          }}
        >
          {t('navigation.invoices')}
        </AppText>
        <AppText variant="caption" color="secondary" weight="semibold" dir="ltr">
          {invoices.length}
        </AppText>
      </View>

      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={{ maxHeight: LIST_MAX_H }}
        contentContainerStyle={{
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {invoices.map((inv) => (
          <AnimatedPressable
            key={inv.id}
            variant="card"
            accessibilityRole="button"
            accessibilityLabel={inv.number}
            onPress={() => {
              void haptics.selection();
              onPressInvoice(inv.id);
            }}
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm + 2,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderStrong,
              }}
            >
              <Ionicons name="receipt-outline" size={18} color={colors.brand} />
            </View>

            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                }}
              >
                <AppText
                  variant="label"
                  weight={titleWeight}
                  numberOfLines={1}
                  dir="ltr"
                  style={{ flex: 1, fontSize: 13, lineHeight: 18 }}
                >
                  {inv.number}
                </AppText>
                <AppText
                  variant="label"
                  weight={titleWeight}
                  color="brand"
                  numberOfLines={1}
                  dir="ltr"
                  style={{ fontSize: 13, lineHeight: 18 }}
                >
                  {formatCurrency(Number(inv.total))}
                </AppText>
              </View>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  flexWrap: 'wrap',
                }}
              >
                <AppText variant="caption" color="muted" style={{ fontSize: 11 }}>
                  {formatDate(inv.invoiceDate)}
                </AppText>
                <StatusBadge status={inv.status} dot />
              </View>
            </View>
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}
