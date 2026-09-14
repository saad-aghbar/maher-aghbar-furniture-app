import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  dealerReturnRailTone,
  returnLifecycleBadgeStatus,
  returnNextActionKey,
  type ReturnCardModel,
} from '../selectReturn';
import { ReturnPhaseStub } from './ReturnPhaseStub';

type Props = {
  item: ReturnCardModel;
  onPress: () => void;
  dealerFacing?: boolean;
};

function toneColor(
  tone: ReturnType<typeof dealerReturnRailTone>,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
  if (tone === 'warning') return colors.warning;
  if (tone === 'success') return colors.success;
  if (tone === 'error') return colors.error;
  return colors.brand;
}

/**
 * Dealer return ticket — filed-date stub + reason/qty inset, not an invoice money stack.
 */
export function ReturnBoardCard({ item, onPress, dealerFacing = false }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const productUri = resolveOrderMediaUri(item.productImageUrl);
  const tone = dealerReturnRailTone(item.lifecyclePhase, item.approvalStatus);
  const accent = toneColor(tone, colors);
  const lifecycleLabel = t(item.lifecycleLabelKey);
  const reasonLabel = (() => {
    const fromCatalog = t(item.reasonLabelKey);
    if (fromCatalog && fromCatalog !== item.reasonLabelKey) return fromCatalog;
    return t(`mobile.returns.reasons.${item.reason}`);
  })();
  const nextAction = t(
    returnNextActionKey(item.lifecyclePhase, {
      dealerFacing,
      needsInfo: item.needsInfo,
    }),
  );
  const orderRef = dealerFacing
    ? item.dealerOrderNumber || item.salesOrderNumber
    : item.salesOrderNumber;

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={`${item.number} ${item.productDesc}`}
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
        <StatusBadge
          status={returnLifecycleBadgeStatus(item.lifecyclePhase)}
          label={lifecycleLabel}
          dot
        />
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
          <ProductThumb uri={productUri} size={56} radius={theme.radius.md} />
          <View style={{ flex: 1, minWidth: 0, gap: 4, justifyContent: 'center' }}>
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
              {t('mobile.returns.folioEyebrow')}
            </AppText>
            <AppText
              weight={titleWeight}
              dir="ltr"
              numberOfLines={1}
              style={{
                fontSize: 18,
                lineHeight: locale === 'ar' ? 28 : 24,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {item.number}
            </AppText>
            <AppText
              variant="caption"
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }}
            >
              {item.productDesc}
            </AppText>
            {item.variantLabel ? (
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {t('mobile.returns.variant')}: {item.variantLabel}
              </AppText>
            ) : null}
            {orderRef ? (
              <AppText variant="caption" color="muted" dir="ltr" numberOfLines={1}>
                {orderRef}
              </AppText>
            ) : null}
          </View>
          <ReturnPhaseStub createdAt={item.createdAt} phase={item.lifecyclePhase} />
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <InsetCell
            label={t('mobile.returns.reason')}
            value={reasonLabel}
            isRTL={isRTL}
            locale={locale}
          />
          <InsetCell
            label={t('catalog.qty')}
            value={item.quantityLabel}
            isRTL={isRTL}
            locale={locale}
            ltr
          />
        </View>
      </View>

      {item.needsInfo || item.lifecyclePhase !== 'RESOLVED' ? (
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
            backgroundColor: item.needsInfo ? colors.warningSoft : colors.surfaceSecondary,
          }}
        >
          <AppText
            variant="caption"
            weight={titleWeight}
            numberOfLines={2}
            style={{
              flex: 1,
              color: item.needsInfo ? colors.warning : colors.textSecondary,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {item.needsInfo ? t('mobile.returns.needsInfoFooter') : nextAction}
          </AppText>
          <View
            style={{
              width: 18,
              height: 3,
              borderRadius: 2,
              backgroundColor: item.needsInfo ? colors.warning : colors.brand,
            }}
          />
        </View>
      ) : null}
    </AnimatedPressable>
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
