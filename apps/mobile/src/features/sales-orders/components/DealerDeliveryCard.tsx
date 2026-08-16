import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { statusLabel as i18nStatusLabel } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { DealerDeliveryDto } from '@/api/modules/scheduling';
import {
  deliveryCardTone,
  productLabel,
  selectCompactCardLine,
  toYmdSlice,
} from '@/features/scheduling/selectDealerDeliveries';
import { OrderCardMedia } from './OrderCardMedia';
import { orderBoardShadow } from './orderFloorStyle';

type Props = {
  row: DealerDeliveryDto;
  onPress: () => void;
  onReviewDate?: () => void;
  index?: number;
  flush?: boolean;
};

function toneColor(
  tone: ReturnType<typeof deliveryCardTone>,
  colors: { brand: string; warning: string; info: string; success: string; textMuted: string },
): string {
  if (tone === 'warning') return colors.warning;
  if (tone === 'info') return colors.info;
  if (tone === 'success') return colors.success;
  if (tone === 'muted') return colors.textMuted;
  return colors.brand;
}

export function DealerDeliveryCard({ row, onPress, onReviewDate, index = 0, flush }: Props) {
  const { t, formatDate, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const name = productLabel(row, locale);
  const compact = selectCompactCardLine(row);
  const status = String(row.customerStatus ?? '');
  const dateYmd = toYmdSlice(compact.dateYmd);
  const requested = toYmdSlice(row.requestedDeliveryDate);
  const earliest = toYmdSlice(row.suggestedDeliveryDate ?? row.projectedDeliveryDate);
  const committed = toYmdSlice(row.committedDeliveryDate);
  const projected = toYmdSlice(row.projectedDeliveryDate);
  const showReview =
    status === 'AWAITING_CONFIRMATION' &&
    (row.canUpdateDeliveryDate || row.canRequestDateChange) &&
    Boolean(onReviewDate);
  const accent = toneColor(deliveryCardTone(status), colors);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const a11yDate = dateYmd ? formatDate(dateYmd) : '';
  const a11y = t('mobile.orders.a11yCard', {
    number: row.salesOrderNumber,
    product: name,
    status: i18nStatusLabel(locale, status),
    date: a11yDate,
  });

  let dateLine: string | null = null;
  if (compact.compact && dateYmd) {
    dateLine = t('mobile.orders.compactOnTrack', { date: formatDate(dateYmd) });
  } else if (status === 'AWAITING_CONFIRMATION') {
    dateLine = earliest
      ? `${t('mobile.orders.earliestAvailable')} ${formatDate(earliest)}`
      : requested
        ? `${t('mobile.orders.requestedShort')} ${formatDate(requested)}`
        : t('mobile.orders.newDateProposed');
  } else if (committed) {
    dateLine =
      projected && projected !== committed
        ? `${t('mobile.orders.confirmedShort')} ${formatDate(committed)} · ${t('mobile.orders.currentExpected')} ${formatDate(projected)}`
        : `${t('mobile.orders.confirmedShort')} ${formatDate(committed)}`;
  } else if (dateYmd) {
    dateLine = formatDate(dateYmd);
  }

  return (
    <ListItemEnter index={index}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={a11y}
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
          marginBottom: flush ? 0 : theme.spacing.sm,
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
            opacity: 0.7,
          }}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
            alignItems: 'flex-start',
          }}
        >
          <OrderCardMedia imageUrl={row.imageUrl ?? null} size={88} />
          <View
            style={{
              flex: 1,
              minWidth: 0,
              gap: 4,
              alignItems: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
                width: '100%',
              }}
            >
              <AppText variant="label" weight={titleWeight} numberOfLines={2} style={{ flex: 1 }}>
                {name}
                {row.quantity != null && row.quantity > 1 ? ` × ${row.quantity}` : ''}
              </AppText>
              <StatusBadge status={status} dot />
            </View>
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={1}
              dir="ltr"
              style={{ letterSpacing: 0.2 }}
            >
              {row.salesOrderNumber}
            </AppText>
            {status === 'AWAITING_CONFIRMATION' ? (
              <AppText variant="caption" color="brand" weight="medium">
                {t('mobile.orders.newDateProposed')}
              </AppText>
            ) : null}
            {row.customerSafeReason ? (
              <AppText variant="caption" color="muted" numberOfLines={2}>
                {t('mobile.orders.productionDelay')}
              </AppText>
            ) : null}
          </View>
        </View>

        <View
          style={{
            marginHorizontal: theme.spacing.md,
            marginBottom: theme.spacing.md,
            paddingTop: theme.spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={2}
            style={{ flex: 1, color: accent }}
          >
            {dateLine}
          </AppText>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <AppText variant="caption" weight="semibold" color="brand">
              {showReview ? t('mobile.orders.reviewDate') : t('mobile.orders.viewOrder')}
            </AppText>
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={14}
              color={colors.brand}
            />
          </View>
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}
