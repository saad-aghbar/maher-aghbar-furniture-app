import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { Divider } from '@/components/layout/Divider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  returnLifecycleBadgeStatus,
  returnNextActionKey,
  returnPhysicalLabelKey,
  type ReturnCardModel,
} from '../selectReturn';

type Props = {
  item: ReturnCardModel;
  onPress: () => void;
  /** Dealer surface: “Your order #” instead of admin “Dealer order #”. */
  dealerFacing?: boolean;
};

/**
 * Returns list floor card — product media only; reason/damage live on detail.
 * Matches purchasing / invoice board language.
 */
export function ReturnBoardCard({ item, onPress, dealerFacing = false }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const productUri = resolveOrderMediaUri(item.productImageUrl);

  const lifecycleLabel = (() => {
    const v = t(item.lifecycleLabelKey);
    return v === item.lifecycleLabelKey ? item.lifecyclePhase.replace(/_/g, ' ') : v;
  })();
  const badgeStatus = returnLifecycleBadgeStatus(item.lifecyclePhase);
  const badgeLabel = lifecycleLabel;
  const nextAction = t(
    returnNextActionKey(item.lifecyclePhase, {
      dealerFacing,
      needsInfo: item.needsInfo,
    }),
  );
  const physicalRaw = t(returnPhysicalLabelKey(item.physicalStatus));
  const physicalLabel =
    physicalRaw === returnPhysicalLabelKey(item.physicalStatus)
      ? item.physicalStatus.replace(/_/g, ' ')
      : physicalRaw;

  const reasonLabel = (() => {
    const fromCatalog = t(item.reasonLabelKey);
    if (fromCatalog && fromCatalog !== item.reasonLabelKey) return fromCatalog;
    const fallback = t(`mobile.returns.reasons.${item.reason}`);
    return fallback !== `mobile.returns.reasons.${item.reason}` ? fallback : item.reason;
  })();

  const catalogLabel = (() => {
    const v = t('catalog.productPhoto');
    return v === 'catalog.productPhoto' ? 'Catalog' : v;
  })();
  const qtyLabel = (() => {
    const v = t('catalog.qty');
    return v === 'catalog.qty' ? 'Qty' : v;
  })();
  const dealerOrderLabel = dealerFacing
    ? t('mobile.dealerAccount.yourOrderNumber')
    : (() => {
        const v = t('sales.dealerOrderNumber');
        return v === 'sales.dealerOrderNumber' ? 'Dealer order #' : v;
      })();
  const orderLabel = (() => {
    const v = t('mobile.returns.order');
    return v === 'mobile.returns.order' ? 'Order' : v;
  })();
  const beingResolvedLabel = (() => {
    const v = t('mobile.returns.beingResolved');
    return v === 'mobile.returns.beingResolved' ? 'Being resolved' : v;
  })();

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
        <StatusBadge status={badgeStatus} label={badgeLabel} dot />
        <AppText variant="caption" color="brand" weight="semibold">
          {t('common.details')}
        </AppText>
      </View>

      {/* Product media — shared ProductThumb aspect */}
      <View
        style={{
          marginHorizontal: theme.spacing.md,
          marginTop: theme.spacing.md,
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <ProductThumb
          uri={productUri}
          aspectRatio={4 / 3}
          width="100%"
          radius={theme.radius.lg}
        />
        <View
          style={{
            position: 'absolute',
            top: theme.spacing.sm,
            ...(isRTL ? { left: theme.spacing.sm } : { right: theme.spacing.sm }),
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: theme.radius.md,
            backgroundColor: 'rgba(28, 24, 20, 0.52)',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{ color: '#fff', fontSize: 10 }}
          >
            {catalogLabel}
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
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="return-down-back-outline" size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <AppText
              variant="label"
              weight={titleWeight}
              dir="ltr"
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 17 }}
            >
              {item.number}
            </AppText>
            <AppText
              weight={titleWeight}
              numberOfLines={2}
              style={{
                textAlign: isRTL ? 'right' : 'left',
                fontSize: 15,
                lineHeight: 20,
                color: colors.textPrimary,
              }}
            >
              {item.productDesc}
            </AppText>
            {!dealerFacing ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  marginTop: 2,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surfaceSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="storefront-outline" size={12} color={colors.textSecondary} />
                </View>
                <AppText
                  variant="caption"
                  color="secondary"
                  numberOfLines={1}
                  style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                >
                  {item.dealerName}
                </AppText>
              </View>
            ) : item.needsInfo ? (
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={1}
                style={{ textAlign: isRTL ? 'right' : 'left', marginTop: 2 }}
              >
                {t('mobile.returns.needInfoHint')}
              </AppText>
            ) : null}
          </View>
        </View>

        {/* Meta board */}
        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <MetaRow
            icon="alert-circle-outline"
            label={(() => {
              const v = t('mobile.returns.reason');
              return v === 'mobile.returns.reason' ? 'Reason' : v;
            })()}
            value={reasonLabel}
            isRTL={isRTL}
            sentenceCase
          />
          <Divider compact plain />
          <MetaRow
            icon="layers-outline"
            label={qtyLabel}
            value={item.quantityLabel}
            isRTL={isRTL}
            valueLtr
          />
          {item.salesOrderNumber ? (
            <>
              <Divider compact plain />
              <MetaRow
                icon="cube-outline"
                label={orderLabel}
                value={item.salesOrderNumber}
                isRTL={isRTL}
                valueLtr
                emphasize
              />
            </>
          ) : null}
          {item.dealerOrderNumber ? (
            <>
              <Divider compact plain />
              <MetaRow
                icon="pricetag-outline"
                label={dealerOrderLabel}
                value={item.dealerOrderNumber}
                isRTL={isRTL}
                valueLtr
              />
            </>
          ) : null}
          <Divider compact />
          <MetaRow
            icon="cube-outline"
            label={(() => {
              const v = t('mobile.returns.physicalState');
              return v === 'mobile.returns.physicalState' ? 'Physical' : v;
            })()}
            value={physicalLabel}
            isRTL={isRTL}
          />
          <Divider compact />
          <MetaRow
            icon="flag-outline"
            label={(() => {
              const v = t('mobile.returns.resolutionState');
              return v === 'mobile.returns.resolutionState' ? 'Resolution' : v;
            })()}
            value={lifecycleLabel}
            isRTL={isRTL}
          />
        </View>

        <View
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.brand,
            backgroundColor: colors.brandSoft,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
            gap: 4,
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              color: colors.brand,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              letterSpacing: locale === 'ar' ? 0 : 0.5,
              fontSize: 10,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {(() => {
              const v = t('mobile.returns.nextAction');
              return v === 'mobile.returns.nextAction' ? 'Next action' : v;
            })()}
          </AppText>
          <AppText
            variant="caption"
            weight="medium"
            style={{
              textAlign: isRTL ? 'right' : 'left',
              color: colors.textPrimary,
              lineHeight: 17,
              fontSize: 12,
            }}
          >
            {nextAction}
          </AppText>
        </View>

        {item.description ? (
          <View
            style={{
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm + 2,
              gap: 4,
            }}
          >
            <AppText
              variant="caption"
              color="muted"
              style={{
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                letterSpacing: locale === 'ar' ? 0 : 0.5,
                fontSize: 10,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {(() => {
                const v = t('mobile.returns.notes');
                return v === 'mobile.returns.notes' ? 'Notes' : v;
              })()}
            </AppText>
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={2}
              style={{
                textAlign: isRTL ? 'right' : 'left',
                lineHeight: 17,
                fontSize: 12,
              }}
            >
              {item.description}
            </AppText>
          </View>
        ) : null}
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
  emphasize,
  sentenceCase,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isRTL: boolean;
  valueLtr?: boolean;
  emphasize?: boolean;
  sentenceCase?: boolean;
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
        backgroundColor: emphasize ? colors.brandSoft : 'transparent',
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: emphasize ? colors.surface : colors.brandSoft,
          borderWidth: 1,
          borderColor: emphasize ? colors.brand : colors.border,
        }}
      >
        <Ionicons
          name={icon}
          size={14}
          color={emphasize ? colors.brand : colors.textSecondary}
        />
      </View>
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: sentenceCase ? 'none' : 'uppercase',
          letterSpacing: sentenceCase ? 0 : 0.45,
          fontSize: 10,
          flexShrink: 0,
          maxWidth: '34%',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight={emphasize ? 'semibold' : 'medium'}
        dir={valueLtr ? 'ltr' : undefined}
        numberOfLines={2}
        style={{
          flex: 1,
          minWidth: 0,
          color: emphasize ? colors.brand : colors.textPrimary,
          textAlign: isRTL ? 'left' : 'right',
          fontSize: 13,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
