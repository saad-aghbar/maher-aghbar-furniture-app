import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { OrderBoardCard } from './OrderBoardCard';

type Props = {
  number: string;
  title: string;
  status?: string | null;
  statusLabel?: string | null;
  dealerName?: string | null;
  customerRef?: string | null;
  metaLine?: string | null;
  deliveryLabel?: string | null;
  showCosts: boolean;
  accent?: string;
};

/**
 * Sales-order identity — header band (status + number), title, dealer / delivery meta.
 */
export function OrderIdentityBoard({
  number,
  title,
  status,
  statusLabel,
  dealerName,
  customerRef,
  metaLine,
  deliveryLabel,
  showCosts,
  accent,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <OrderBoardCard
      accent={accent ?? colors.brand}
      header={
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          {status ? (
            <StatusBadge
              status={status}
              label={statusLabel ?? undefined}
              dot
            />
          ) : (
            <AppText variant="caption" weight={titleWeight} color="brand">
              {t('mobile.orders.journey.identityEyebrow')}
            </AppText>
          )}
          <AppText
            variant="caption"
            color="brand"
            weight={titleWeight}
            dir="ltr"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {number}
          </AppText>
        </View>
      }
    >
      <AppText
        variant="title"
        weight={titleWeight}
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {title}
      </AppText>
      {metaLine ? (
        <AppText
          variant="caption"
          color="secondary"
          dir="ltr"
          style={{
            letterSpacing: locale === 'ar' ? 0 : 0.2,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {metaLine}
        </AppText>
      ) : null}

      <View
        style={{
          marginTop: theme.spacing.xs,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.md,
          gap: theme.spacing.xs,
        }}
      >
        {!showCosts && customerRef ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.orderDetail.customerRef')}: {customerRef}
          </AppText>
        ) : null}
        {showCosts && dealerName ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.orders.dealer')}: {dealerName}
          </AppText>
        ) : null}
        {deliveryLabel ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {deliveryLabel}
          </AppText>
        ) : null}
        {!customerRef && !dealerName && !deliveryLabel ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {number}
          </AppText>
        ) : null}
      </View>
    </OrderBoardCard>
  );
}
