import { View } from 'react-native';
import { presentQuotationStatus } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  dealerCanDecideQuotation,
  dealerQuoteRailTone,
  quotationLinkedRef,
  type DealerQuoteRow,
} from '../dealerQuotationUi';
import { QuotationValidityStub } from './QuotationValidityStub';

type Props = {
  quotation: DealerQuoteRow;
  onPress: () => void;
  onPdf?: () => void;
};

function toneColor(
  tone: ReturnType<typeof dealerQuoteRailTone>,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
  if (tone === 'warning') return colors.warning;
  if (tone === 'success') return colors.success;
  if (tone === 'error') return colors.error;
  return colors.brand;
}

/**
 * Dealer quote folio — validity stub + offer inset, not an invoice money stack.
 */
export function QuotationBoardCard({ quotation, onPress, onPdf }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const tone = dealerQuoteRailTone(quotation.status, quotation.commerciallyExpired);
  const accent = toneColor(tone, colors);
  const needsReply = dealerCanDecideQuotation(
    quotation.status,
    quotation.commerciallyExpired,
  );
  const revised = (quotation.version ?? 1) > 1;
  const linked = quotationLinkedRef(quotation);
  const total = Number(quotation.total);
  const totalLabel = Number.isFinite(total)
    ? `${formatNumber(locale, total, { maximumFractionDigits: 2 })} ₪`
    : '—';
  const statusLabel = presentQuotationStatus(
    locale,
    quotation.status,
    quotation.commerciallyExpired,
  );

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={quotation.number}
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
          backgroundColor: accent,
          opacity: tone === 'brand' ? 0.55 : 0.9,
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
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flex: 1,
            minWidth: 0,
          }}
        >
          <StatusBadge status={quotation.status} label={statusLabel} dot />
          {revised ? (
            <StatusBadge
              status="REVISION"
              label={t('mobile.adminQuotation.revised')}
              branded
            />
          ) : null}
        </View>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          {onPdf ? (
            <AnimatedPressable
              variant="button"
              onPress={() => {
                void haptics.selection();
                onPdf();
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
            alignItems: 'stretch',
            gap: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 6, justifyContent: 'center' }}>
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
              {t('mobile.dealerQuotations.folioEyebrow')}
            </AppText>
            <AppText
              weight={titleWeight}
              dir="ltr"
              numberOfLines={1}
              style={{
                fontSize: 20,
                lineHeight: locale === 'ar' ? 30 : 26,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {quotation.number}
            </AppText>
            {linked ? (
              <View
                style={{
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
                  paddingHorizontal: theme.spacing.sm + 2,
                  paddingVertical: 4,
                  borderRadius: theme.radius.full,
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.brand,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  dir="ltr"
                  numberOfLines={1}
                  style={{ color: colors.brand }}
                >
                  {linked}
                </AppText>
              </View>
            ) : null}
          </View>
          <QuotationValidityStub
            expirationDate={quotation.expirationDate}
            commerciallyExpired={quotation.commerciallyExpired}
          />
        </View>

        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
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
            {t('mobile.dealerQuotations.offer')}
          </AppText>
          <AppText
            weight={titleWeight}
            dir="ltr"
            numberOfLines={1}
            style={{
              fontSize: 22,
              lineHeight: locale === 'ar' ? 34 : 28,
              textAlign: isRTL ? 'right' : 'left',
              fontVariant: ['tabular-nums'],
            }}
          >
            {totalLabel}
          </AppText>
        </View>
      </View>

      {needsReply ? (
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
            backgroundColor: colors.warningSoft,
          }}
        >
          <AppText
            variant="caption"
            weight={titleWeight}
            style={{ color: colors.warning, flex: 1 }}
            numberOfLines={1}
          >
            {t('mobile.dealerQuotations.needsReply')}
          </AppText>
          <View
            style={{
              width: 18,
              height: 3,
              borderRadius: 2,
              backgroundColor: colors.warning,
            }}
          />
        </View>
      ) : null}
    </AnimatedPressable>
  );
}
