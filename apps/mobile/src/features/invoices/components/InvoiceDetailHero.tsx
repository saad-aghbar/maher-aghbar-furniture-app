import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { InvoiceDetailModel } from '../selectInvoice';

type Props = {
  model: InvoiceDetailModel;
};

/**
 * Invoice identity hero — document board with status strip, number, dealer, order chips.
 */
export function InvoiceDetailHero({ model }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const overdue = model.isOverdue;
  const accent = overdue ? colors.error : colors.brand;

  return (
    <View
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
        pointerEvents="none"
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
        <StatusBadge status={model.status} dot />
        <AppText variant="caption" color="brand" weight="semibold">
          {t('accounting.detail')}
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
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: overdue ? `${colors.error}18` : colors.brandSoft,
              borderWidth: 1,
              borderColor: overdue ? colors.error : colors.border,
            }}
          >
            <Ionicons
              name="document-text-outline"
              size={24}
              color={overdue ? colors.error : colors.brand}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <AppText
              weight={titleWeight}
              dir="ltr"
              numberOfLines={2}
              style={{
                fontSize: 22,
                lineHeight: 28,
                textAlign: isRTL ? 'right' : 'left',
                color: colors.textPrimary,
              }}
            >
              {model.number}
            </AppText>
            <AppText
              variant="body"
              color="secondary"
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 20 }}
            >
              {model.dealerName}
            </AppText>
          </View>
        </View>

        {model.factoryOrderNumber || model.dealerChip ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
            }}
          >
            {model.factoryOrderNumber ? (
              <RefChip
                label={`${t('accounting.factoryOrderShort')} ${model.factoryOrderNumber}`}
              />
            ) : null}
            {model.dealerChip ? (
              <RefChip
                label={
                  model.dealerChip.prefixDealer
                    ? `${t('accounting.dealerOrderShort')} ${model.dealerChip.value}`
                    : model.dealerChip.value
                }
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
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
        flexShrink: 0,
      }}
    >
      <AppText variant="caption" weight="semibold" dir="ltr" style={{ color: colors.brand }}>
        {label}
      </AppText>
    </View>
  );
}
