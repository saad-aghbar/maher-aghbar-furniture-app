import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { localizedName } from '@maher/i18n';
import type { DeliveryListItem } from '@/api/modules/deliveries';
import { AppText } from '@/components/AppText';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { Divider } from '@/components/layout/Divider';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  DELIVERY_FLOOR_CHARCOAL,
  DELIVERY_FLOOR_CREAM,
} from '../deliveryFloorStyle';
import { selectDeliveryHumanPhase } from '../deliveryHumanPhase';

/** Wide landscape crop so the board fills the screen width visually. */
const MEDIA_ASPECT = 1.45;

export function deliveryDealerLabel(item: DeliveryListItem, locale: string): string {
  const c = item.customer;
  if (!c) return '—';
  return (
    localizedName(locale, {
      nameEn: c.nameEn,
      nameAr: c.nameAr,
      nameHe: c.nameHe,
      name: c.name,
    }) || '—'
  );
}

export function deliveryProductLabel(item: DeliveryListItem, locale: string): string {
  return (
    localizedName(locale, {
      nameEn: item.productNameEn,
      nameAr: item.productNameAr,
      nameHe: item.productNameHe,
      name: item.productTitle,
    }) ||
    item.productTitle ||
    item.items?.[0]?.description ||
    deliveryDealerLabel(item, locale)
  );
}

type Props = {
  item: DeliveryListItem;
  index?: number;
  completed?: boolean;
  animateEnter?: boolean;
  /** Slightly taller media for home “current” feel when used as hero sibling. */
  emphasize?: boolean;
};

function MetaRow({
  iconName,
  label,
  value,
  isRTL,
  valueLtr,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
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
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 1,
      }}
    >
      <Ionicons name={iconName} size={15} color={colors.textMuted} />
      <AppText variant="caption" color="muted" style={{ minWidth: 56 }}>
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight="semibold"
        numberOfLines={2}
        dir={valueLtr ? 'ltr' : undefined}
        style={{ flex: 1, textAlign: isRTL ? 'left' : 'right', color: colors.textPrimary }}
      >
        {value}
      </AppText>
    </View>
  );
}

/**
 * Full-width industrial delivery board — photo crop, dealer, order meta, load progress.
 */
export function DeliveryFloorOrderCard({
  item,
  index = 0,
  completed = false,
  animateEnter = true,
  emphasize = false,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const progress = item.loadProgress;
  const loaded = progress?.loaded ?? 0;
  const total = progress?.total ?? 0;
  const ratio = total > 0 ? Math.min(1, loaded / total) : 0;
  const phase = selectDeliveryHumanPhase({
    status: item.status,
    loaded,
    total,
    canDepart: item.allLoaded === true && !completed,
  });
  const accent =
    phase.phase === 'delivered' || phase.phase === 'shipped'
      ? colors.success
      : phase.phase === 'attention'
        ? colors.warning
        : colors.brand;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const mediaUri = resolveOrderMediaUri(item.imageUrl);
  const productTitle = deliveryProductLabel(item, locale);
  const dealer = deliveryDealerLabel(item, locale);
  const orderNumber = item.salesOrder?.number ?? item.number;
  const fadeBottom = colorScheme === 'dark' ? 0.72 : 0.58;
  const mediaAspect = emphasize ? 1.2 : MEDIA_ASPECT;
  const phaseLabel = t(phase.labelKey);
  const whyLabel = (() => {
    if (
      phase.whyKey === 'mobile.deliveryLoad.attentionLoadIncomplete' &&
      item.firstMissingPackageIndex != null &&
      total > 0
    ) {
      return t('mobile.deliveryLoad.packageMissingDetail', {
        index: item.firstMissingPackageIndex,
        total,
      });
    }
    return phase.whyKey ? t(phase.whyKey) : null;
  })();

  const open = () => {
    void haptics.selection();
    router.push(`/(app)/(employee)/deliveries/${item.id}` as Href);
  };

  const body = (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={`${productTitle} ${orderNumber}`}
      onPress={open}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor:
          phase.phase === 'attention'
            ? colors.warning
            : completed
              ? colors.success
              : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        marginBottom: theme.spacing.md,
        width: '100%',
        alignSelf: 'stretch',
        ...theme.elevation.raised,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 4,
          backgroundColor: accent,
          opacity: 0.95,
          zIndex: 2,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 4,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 6 }
            : { paddingLeft: theme.spacing.md + 6 }),
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
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: theme.radius.full,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              maxWidth: '62%',
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              numberOfLines={1}
              dir="ltr"
              style={{
                color: colors.brand,
                fontSize: 11,
                letterSpacing: locale === 'ar' ? 0 : 0.4,
              }}
            >
              {item.number}
            </AppText>
          </View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 9,
              paddingVertical: 5,
              borderRadius: theme.radius.full,
              backgroundColor: completed ? colors.successSoft : colors.brandSoft,
              borderWidth: 1,
              borderColor: accent,
            }}
          >
            <Ionicons
              name={
                phase.phase === 'delivered' || phase.phase === 'shipped'
                  ? 'navigate-outline'
                  : phase.phase === 'attention'
                    ? 'alert-circle-outline'
                    : 'cube-outline'
              }
              size={12}
              color={accent}
            />
            <AppText
              variant="caption"
              weight="semibold"
              numberOfLines={1}
              style={{ color: accent, fontSize: 11 }}
            >
              {phaseLabel}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" color="brand" weight="semibold" numberOfLines={1}>
          {completed
            ? t('mobile.deliveryLoad.viewDelivery')
            : t('mobile.deliveryLoad.openLoadSheet')}
        </AppText>
      </View>

      {/* Full-bleed product photo — shared ProductThumb crop */}
      <View
        style={{
          aspectRatio: mediaAspect,
          width: '100%',
          backgroundColor: DELIVERY_FLOOR_CHARCOAL,
          overflow: 'hidden',
        }}
      >
          <ProductThumb
            uri={mediaUri}
            aspectRatio={mediaAspect}
            width="100%"
            radius={0}
            style={{ borderWidth: 0 }}
          />

          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '46%',
            }}
          >
            <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
              <Defs>
                <SvgGradient id={`dlvMediaFade-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={DELIVERY_FLOOR_CHARCOAL} stopOpacity="0" />
                  <Stop
                    offset="0.45"
                    stopColor={DELIVERY_FLOOR_CHARCOAL}
                    stopOpacity={fadeBottom * 0.35}
                  />
                  <Stop
                    offset="1"
                    stopColor={DELIVERY_FLOOR_CHARCOAL}
                    stopOpacity={fadeBottom}
                  />
                </SvgGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill={`url(#dlvMediaFade-${item.id})`}
              />
            </Svg>
            <View
              style={{
                flex: 1,
                justifyContent: 'flex-end',
                paddingHorizontal: theme.spacing.md,
                paddingBottom: theme.spacing.sm + 2,
                alignItems: isRTL ? 'flex-start' : 'flex-end',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                dir="ltr"
                style={{
                  color: DELIVERY_FLOOR_CREAM,
                  fontSize: 12,
                  letterSpacing: 0.35,
                }}
              >
                {orderNumber}
              </AppText>
            </View>
          </View>
      </View>

      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.md,
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 6 }
            : { paddingLeft: theme.spacing.md + 6 }),
        }}
      >
        {whyLabel ? (
          <View
            style={{
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: colors.warning,
              backgroundColor: colors.warningSoft,
              paddingHorizontal: theme.spacing.sm + 2,
              paddingVertical: theme.spacing.sm,
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              style={{ color: colors.warning, textAlign: isRTL ? 'right' : 'left' }}
            >
              {whyLabel}
            </AppText>
          </View>
        ) : null}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: completed ? colors.successSoft : colors.brandSoft,
              borderWidth: 1,
              borderColor: accent,
            }}
          >
            <Ionicons
              name={completed ? 'checkmark-circle-outline' : 'cube-outline'}
              size={18}
              color={accent}
            />
          </View>
          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={2}
            style={{
              flex: 1,
              textAlign: isRTL ? 'right' : 'left',
              fontSize: 16,
              lineHeight: 22,
            }}
          >
            {productTitle}
          </AppText>
        </View>

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
            iconName="business-outline"
            label={t('mobile.deliveryLoad.cardDealer')}
            value={dealer}
            isRTL={isRTL}
          />
          <Divider compact />
          <MetaRow
            iconName="document-text-outline"
            label={t('mobile.deliveryLoad.cardOrder')}
            value={orderNumber}
            isRTL={isRTL}
            valueLtr
          />
          <Divider compact />
          <MetaRow
            iconName="location-outline"
            label={t('mobile.deliveryLoad.cardAddress')}
            value={item.deliveryAddress}
            isRTL={isRTL}
          />
          {!completed && total > 0 ? (
            <>
              <Divider compact />
              <View
                style={{
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm + 2,
                  gap: 8,
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <AppText variant="caption" color="muted">
                    {t('mobile.deliveryLoad.cardPackages')}
                  </AppText>
                  <AppText variant="caption" weight="semibold" color="brand">
                    {t('mobile.deliveryLoad.packagesProgress', { loaded, total })}
                  </AppText>
                </View>
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.surface,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(ratio * 100)}%`,
                      height: '100%',
                      backgroundColor: colors.brand,
                      borderRadius: 4,
                    }}
                  />
                </View>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );

  if (!animateEnter) return body;
  return <ListItemEnter index={index}>{body}</ListItemEnter>;
}
