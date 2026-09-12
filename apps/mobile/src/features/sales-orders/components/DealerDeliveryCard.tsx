import { View } from 'react-native';
import { statusLabel as i18nStatusLabel } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { DealerDeliveryDto } from '@/api/modules/scheduling';
import {
  DEALER_JOURNEY_LABEL_KEY,
  deliveryCardTone,
  productLabel,
  selectDeliveryTimeline,
  selectScheduleStub,
} from '@/features/scheduling/selectDealerDeliveries';
import { DealerScheduleDateStub } from '@/features/scheduling/components/DealerScheduleDateStub';
import { resolveOrderMediaUri } from './OrderCardMedia';
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
  colors: { brand: string; warning: string; success: string; textMuted: string },
): string {
  if (tone === 'warning') return colors.warning;
  if (tone === 'success') return colors.success;
  if (tone === 'muted') return colors.textMuted;
  return colors.brand;
}

/**
 * Dealer delivery ticket — date stub + address/qty inset, not a flat media row.
 */
export function DealerDeliveryCard({ row, onPress, onReviewDate, index = 0, flush }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const name = productLabel(row, locale);
  const status = String(row.customerStatus ?? '');
  const stub = selectScheduleStub(row);
  const timeline = selectDeliveryTimeline({
    customerStatus: status,
    committedDeliveryDate: row.committedDeliveryDate,
  });
  const currentStep = timeline.find((step) => step.current);
  const journeyLabel = currentStep
    ? t(DEALER_JOURNEY_LABEL_KEY[currentStep.key] ?? '')
    : '';
  const showReview =
    status === 'AWAITING_CONFIRMATION' &&
    (row.canUpdateDeliveryDate || row.canRequestDateChange) &&
    Boolean(onReviewDate);
  const railTone = deliveryCardTone(status);
  const accent = toneColor(railTone, colors);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const productUri = resolveOrderMediaUri(row.imageUrl);
  const qtyLabel =
    row.quantity != null && Number.isFinite(Number(row.quantity))
      ? String(row.quantity)
      : '—';
  const address = row.deliveryAddress?.trim() || '—';

  const a11y = t('mobile.orders.a11yCard', {
    number: row.salesOrderNumber,
    product: name,
    status: i18nStatusLabel(locale, status),
    date: stub.ymd ?? '',
  });

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
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: railTone === 'brand' ? 0.55 : 0.9,
          }}
        />

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm + 2,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <StatusBadge status={status} label={i18nStatusLabel(locale, status)} dot />
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
              alignItems: 'stretch',
              gap: theme.spacing.md,
            }}
          >
            <ProductThumb uri={productUri} size={64} radius={theme.radius.md} />
            <View style={{ flex: 1, minWidth: 0, gap: 4, justifyContent: 'center' }}>
              <AppText
                weight={titleWeight}
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 16 }}
              >
                {name}
              </AppText>
              <AppText variant="caption" color="muted" dir="ltr" numberOfLines={1}>
                {row.salesOrderNumber}
              </AppText>
            </View>
            <DealerScheduleDateStub ymd={stub.ymd} kind={stub.kind} />
          </View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            <InsetCell
              label={t('mobile.orders.address')}
              value={address}
              isRTL={isRTL}
              locale={locale}
            />
            <InsetCell
              label={t('mobile.orders.qty')}
              value={qtyLabel}
              isRTL={isRTL}
              locale={locale}
              ltr
            />
          </View>
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm + 2,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: showReview ? colors.warningSoft : colors.surfaceSecondary,
          }}
        >
          <AppText
            variant="caption"
            weight={titleWeight}
            numberOfLines={2}
            style={{
              flex: 1,
              color: showReview ? colors.warning : colors.textSecondary,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {showReview
              ? t('mobile.orders.reviewDate')
              : journeyLabel || t('mobile.orders.viewOrder')}
          </AppText>
          <View
            style={{
              width: 18,
              height: 3,
              borderRadius: 2,
              backgroundColor: showReview ? colors.warning : colors.brand,
            }}
          />
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}

function InsetCell({
  label,
  value,
  isRTL,
  locale,
  ltr,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  locale: string;
  ltr?: boolean;
}) {
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        gap: 4,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.45,
          fontSize: 10,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight={titleWeight}
        dir={ltr ? 'ltr' : undefined}
        numberOfLines={2}
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {value}
      </AppText>
    </View>
  );
}
