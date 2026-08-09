import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { Divider } from '@/components/layout/Divider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { SupplierInvoiceCardModel } from '../selectPurchase';

type Props = {
  invoice: SupplierInvoiceCardModel;
  onPress: () => void;
};

export function SupplierInvoiceBoardCard({ invoice, onPress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const due = invoice.hasBalance;
  const hasPo = Boolean(invoice.linkedPoNumber);
  const accent = due ? colors.warning : colors.brand;

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={invoice.number}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: due ? colors.warning : colors.borderStrong,
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
          opacity: due ? 0.85 : 0.55,
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
        <AppText variant="caption" color="brand" weight="semibold">
          {t('common.details')}
        </AppText>
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
              backgroundColor: due ? `${colors.warning}22` : colors.brandSoft,
              borderWidth: 1,
              borderColor: due ? colors.warning : colors.border,
            }}
          >
            <Ionicons
              name="receipt-outline"
              size={20}
              color={due ? colors.warning : colors.brand}
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
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 18 }}
            >
              {invoice.supplierName}
            </AppText>
          </View>
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
            paddingHorizontal: theme.spacing.sm + 2,
            paddingVertical: 6,
            borderRadius: theme.radius.full,
            backgroundColor: hasPo ? colors.brandSoft : colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: hasPo ? colors.brand : colors.border,
            borderStyle: hasPo ? 'solid' : 'dashed',
          }}
        >
          <Ionicons
            name="cube-outline"
            size={14}
            color={hasPo ? colors.brand : colors.textMuted}
          />
          <AppText
            variant="caption"
            weight={hasPo ? 'semibold' : 'medium'}
            dir="ltr"
            numberOfLines={1}
            style={{ color: hasPo ? colors.brand : colors.textMuted }}
          >
            {hasPo
              ? `${t('catalog.poShort')} ${invoice.linkedPoNumber}`
              : `${t('catalog.poShort')} —`}
          </AppText>
        </View>

        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: due ? `${colors.warning}14` : colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: due ? colors.warning : colors.border,
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
              {t('catalog.outstandingShort')}
            </AppText>
            <AppText
              weight={titleWeight}
              dir="ltr"
              style={{
                fontSize: due ? 26 : 22,
                lineHeight: due ? 30 : 26,
                textAlign: isRTL ? 'right' : 'left',
                color: due ? colors.warning : colors.textSecondary,
              }}
            >
              {`${invoice.outstandingLabel} JOD`}
            </AppText>
          </View>

          <Divider compact />

          <MoneyRow
            label={t('catalog.totalShort')}
            value={`${invoice.totalLabel} JOD`}
            isRTL={isRTL}
          />
          <Divider compact />
          <MoneyRow
            label={t('catalog.paid')}
            value={`${invoice.paidLabel} JOD`}
            isRTL={isRTL}
          />
        </View>

        {invoice.dueDateLabel ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            </View>
            <AppText
              variant="caption"
              color="secondary"
              dir="ltr"
              style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
            >
              {invoice.dueDateLabel}
            </AppText>
          </View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

function MoneyRow({
  label,
  value,
  isRTL,
}: {
  label: string;
  value: string;
  isRTL: boolean;
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
          color: colors.textPrimary,
          textAlign: isRTL ? 'left' : 'right',
          fontSize: 13,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
