import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { Divider } from '@/components/layout/Divider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InvoiceCardModel } from '../selectInvoice';

type Props = {
  invoice: InvoiceCardModel;
  onPress: () => void;
  onPdf?: () => void;
  currencySuffix?: string;
  /** Dealer portal — hide dealer name (PDF still available when onPdf is passed). */
  dealerFacing?: boolean;
};

/**
 * Amount-due-first invoice floor card — Paid / Account credit / Overdue tones.
 */
export function InvoiceBoardCard({
  invoice,
  onPress,
  onPdf,
  currencySuffix = '₪',
  dealerFacing = false,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const overdue = invoice.isOverdue;
  const accent = overdue ? colors.error : colors.brand;
  const showPdf = Boolean(onPdf);
  const showCredit = invoice.availableCredit > 0.001;
  const dealerOrderLabel = dealerFacing
    ? (() => {
        const v = t('mobile.dealerAccount.yourOrderNumber');
        return v === 'mobile.dealerAccount.yourOrderNumber'
          ? t('accounting.dealerOrderShort')
          : v;
      })()
    : t('accounting.dealerOrderShort');

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={
        dealerFacing ? invoice.number : `${invoice.number} ${invoice.dealerName}`
      }
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: overdue ? colors.error : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: overdue ? 0.9 : 0.55,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <StatusBadge status={invoice.status} dot />
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          {showPdf ? (
            <AnimatedPressable
              variant="button"
              onPress={() => {
                void haptics.selection();
                onPdf?.();
              }}
              hitSlop={8}
            >
              <AppText variant="caption" color="brand" weight="semibold">
                {t('catalog.pdf')}
              </AppText>
            </AnimatedPressable>
          ) : null}
          <AppText variant="caption" color="brand" weight="semibold">
            {t('common.details')}
          </AppText>
        </View>
      </View>

      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.md,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: overdue ? `${colors.error}18` : colors.brandSoft,
              borderWidth: 1,
              borderColor: overdue ? colors.error : colors.border,
            }}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color={overdue ? colors.error : colors.brand}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <AppText
              variant="label"
              weight={titleWeight}
              dir="ltr"
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 17 }}
            >
              {invoice.number}
            </AppText>
            {!dealerFacing ? (
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 18 }}
              >
                {invoice.dealerName}
              </AppText>
            ) : null}
          </View>
        </View>

        {(invoice.factoryOrderNumber || invoice.dealerOrderNumber) && (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
            }}
          >
            {!dealerFacing && invoice.factoryOrderNumber ? (
              <RefChip
                label={`${t('accounting.factoryOrderShort')} ${invoice.factoryOrderNumber}`}
              />
            ) : null}
            {invoice.dealerOrderNumber ? (
              <RefChip
                label={`${dealerOrderLabel} ${invoice.dealerOrderNumber}`}
              />
            ) : null}
            {dealerFacing && !invoice.dealerOrderNumber && invoice.factoryOrderNumber ? (
              <RefChip
                label={`${dealerOrderLabel} ${invoice.factoryOrderNumber}`}
              />
            ) : null}
          </View>
        )}

        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: overdue ? `${colors.error}12` : colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: overdue ? colors.error : colors.border,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingTop: theme.spacing.md,
              paddingBottom: theme.spacing.sm + 2,
              gap: 4,
            }}
          >
            <AppText
              variant="caption"
              color="muted"
              style={{
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                letterSpacing: locale === 'ar' ? 0 : 0.55,
                fontSize: 10,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('accounting.amountDue')}
            </AppText>
            <AppText
              weight={titleWeight}
              dir="ltr"
              style={{
                fontSize: overdue ? 26 : 22,
                lineHeight:
                  locale === 'ar'
                    ? overdue
                      ? 40
                      : 34
                    : overdue
                      ? 32
                      : 28,
                textAlign: isRTL ? 'right' : 'left',
                color: overdue ? colors.error : colors.textPrimary,
              }}
            >
              {`${invoice.amountDueLabel} ${currencySuffix}`}
            </AppText>
            {overdue ? (
              <AppText
                variant="caption"
                style={{ color: colors.error, textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('accounting.overdueHint')}
              </AppText>
            ) : null}
          </View>

          <View style={{ height: 1, alignSelf: 'stretch', backgroundColor: colors.border }} />

          <MoneyRow
            label={t('accounting.paidAmount')}
            value={`${invoice.paidLabel} ${currencySuffix}`}
            isRTL={isRTL}
            valueColor={invoice.paid > 0 ? colors.success : undefined}
          />
          {showCredit ? (
            <>
              <Divider compact />
              <MoneyRow
                label={t('accounting.accountCredit')}
                value={`${invoice.availableCreditLabel} ${currencySuffix}`}
                isRTL={isRTL}
                valueColor={colors.success}
              />
            </>
          ) : null}
          <Divider compact />
          <MoneyRow
            label={t('accounting.total')}
            value={`${invoice.totalLabel} ${currencySuffix}`}
            isRTL={isRTL}
          />
          {invoice.dueDateLabel ? (
            <>
              <View
                style={{ height: 1, alignSelf: 'stretch', backgroundColor: colors.border }}
              />
              <MoneyRow
                label={t('accounting.dueDate')}
                value={invoice.dueDateLabel}
                isRTL={isRTL}
              />
            </>
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

function RefChip({ label }: { label: string }) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.sm + 2,
        paddingVertical: 5,
        borderRadius: theme.radius.full,
        backgroundColor: colors.brandSoft,
        borderWidth: 1,
        borderColor: colors.brand,
      }}
    >
      <AppText variant="caption" weight="semibold" dir="ltr" style={{ color: colors.brand }}>
        {label}
      </AppText>
    </View>
  );
}

function MoneyRow({
  label,
  value,
  isRTL,
  valueColor,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  valueColor?: string;
}) {
  const { colors, theme } = useTheme();
  return (
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
          textTransform: 'uppercase',
          letterSpacing: 0.45,
          fontSize: 10,
          flexShrink: 0,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight="semibold"
        dir="ltr"
        numberOfLines={1}
        style={{
          flex: 1,
          minWidth: 0,
          color: valueColor ?? colors.textPrimary,
          textAlign: isRTL ? 'left' : 'right',
          fontSize: 13,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
