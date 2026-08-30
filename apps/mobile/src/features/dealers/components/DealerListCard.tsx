import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CustomerListItem } from '@/api/modules/customers';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { formatPhoneForDisplay } from '@/components/forms/countryDialCodes';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { localizedName } from '@maher/i18n';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { dealerIdentitySubtitle, hasVisibleContact } from '../dealerDetailDisplay';

type Props = {
  dealer: CustomerListItem;
  onPress: () => void;
};

/**
 * Dealer list floor card — same board language as invoices / returns / purchasing:
 * header band, identity row, inset meta boards, money hierarchy.
 */
export function DealerListCard({ dealer, onPress }: Props) {
  const { t, locale, isRTL, formatCurrency } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const name = localizedName(locale, dealer, dealer.code || '—');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const initial = (name || dealer.code || '?').trim().charAt(0).toUpperCase();
  const outstanding = Number(dealer.outstandingTotal ?? 0);
  const paid = Number(dealer.paidTotal ?? 0);
  const hasBalance = outstanding > 0.009;
  const status = String(dealer.status || 'ACTIVE');

  const metrics = [
    {
      key: 'w',
      label: t('customers.ordersWaiting'),
      value: dealer.waitingOrdersCount ?? 0,
      icon: 'time-outline' as const,
    },
    {
      key: 'i',
      label: t('customers.ordersInWork'),
      value: dealer.inWorkOrdersCount ?? 0,
      icon: 'construct-outline' as const,
    },
    {
      key: 'd',
      label: t('customers.ordersDone'),
      value: dealer.doneOrdersCount ?? 0,
      icon: 'checkmark-circle-outline' as const,
    },
  ];

  const identitySubtitle = dealerIdentitySubtitle(name, dealer.companyName, '');
  const phoneRaw = dealer.phone?.trim() ?? '';
  const faxRaw = dealer.fax?.trim() ?? '';
  const phone = hasVisibleContact(phoneRaw) ? formatPhoneForDisplay(phoneRaw) : null;
  const fax = hasVisibleContact(faxRaw) ? formatPhoneForDisplay(faxRaw) : null;
  const code = dealer.code?.trim() || '';

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
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
          backgroundColor: colors.brand,
          opacity: 0.55,
        }}
      />

      {/* Header band */}
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
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flex: 1,
            minWidth: 0,
          }}
        >
          <StatusBadge status={status} dot />
          {code ? (
            <AppText
              variant="caption"
              weight="semibold"
              dir="ltr"
              numberOfLines={1}
              style={{ color: colors.brand, flexShrink: 1 }}
            >
              {code}
            </AppText>
          ) : null}
        </View>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 2,
            flexShrink: 0,
          }}
        >
          <AppText variant="caption" color="brand" weight="semibold">
            {t('common.details')}
          </AppText>
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={14}
            color={colors.brand}
          />
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
        {/* Identity */}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.md,
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
            <AppText
              weight="semibold"
              style={{ color: colors.brand, fontSize: 18, lineHeight: 22 }}
            >
              {initial}
            </AppText>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={2}
              style={{
                textAlign: isRTL ? 'right' : 'left',
                fontSize: 17,
                lineHeight: 22,
              }}
            >
              {name}
            </AppText>
            {identitySubtitle ? (
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={1}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {identitySubtitle}
              </AppText>
            ) : null}
          </View>
        </View>

        {phone || fax ? (
          <View
            style={{
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            {phone ? (
              <MetaRow
                icon="call-outline"
                label={t('customers.phone')}
                value={phone}
                isRTL={isRTL}
                valueLtr
              />
            ) : null}
            {fax ? (
              <>
                {phone ? <BoardHairline /> : null}
                <MetaRow
                  icon="print-outline"
                  label={t('customers.fax')}
                  value={fax}
                  isRTL={isRTL}
                  valueLtr
                />
              </>
            ) : null}
          </View>
        ) : null}

        {/* Order buckets — three inset tiles */}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          {metrics.map((m) => (
            <View
              key={m.key}
              style={{
                flex: 1,
                minWidth: 0,
                borderRadius: theme.radius.lg,
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.sm,
                alignItems: 'center',
                gap: 6,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name={m.icon} size={14} color={colors.brand} />
              </View>
              <AppText
                variant="caption"
                color="muted"
                align="center"
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  letterSpacing: locale === 'ar' ? 0 : 0.15,
                }}
              >
                {m.label}
              </AppText>
              <AppText
                weight="semibold"
                align="center"
                dir="ltr"
                style={{ fontSize: 20, lineHeight: 24, letterSpacing: -0.3 }}
              >
                {String(m.value)}
              </AppText>
            </View>
          ))}
        </View>

        {/* Money board — outstanding-first like invoices */}
        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: hasBalance ? colors.warningSoft : colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: hasBalance ? colors.warning : colors.border,
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
              {t('customers.amountLeft')}
            </AppText>
            <AppText
              weight={titleWeight}
              dir="ltr"
              style={{
                fontSize: hasBalance ? 24 : 20,
                lineHeight: hasBalance ? 28 : 24,
                textAlign: isRTL ? 'right' : 'left',
                color: hasBalance ? colors.warning : colors.textPrimary,
              }}
            >
              {formatCurrency(outstanding)}
            </AppText>
          </View>
          <BoardHairline />
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
              {t('customers.amountPaid')}
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
              {formatCurrency(paid)}
            </AppText>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

function MetaRow({
  icon,
  label,
  value,
  isRTL,
  valueLtr,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isRTL: boolean;
  valueLtr?: boolean;
}) {
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brandSoft,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={icon} size={14} color={colors.textSecondary} />
      </View>
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: 'uppercase',
          letterSpacing: 0.45,
          fontSize: 10,
          flexShrink: 0,
          maxWidth: '34%',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight="medium"
        dir={valueLtr ? 'ltr' : undefined}
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

function BoardHairline() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: 1, backgroundColor: colors.border }}
    />
  );
}
