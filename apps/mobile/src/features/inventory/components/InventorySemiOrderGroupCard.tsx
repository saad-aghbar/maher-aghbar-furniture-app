import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { AppText } from '@/components/AppText';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { SemiOrderGroup } from '../selectSemiOrders';

type Props = {
  order: SemiOrderGroup;
  index?: number;
  animateEnter?: boolean;
  onPress?: () => void;
};

/** Same crop as IndustrialFloorTaskCard / kit cards. */
const MEDIA_ASPECT = 1.28;

function productName(order: SemiOrderGroup, locale: string): string {
  const p = order.product;
  if (!p) return order.productDescription;
  if (locale === 'ar') return p.nameAr || p.nameEn;
  if (locale === 'he') return p.nameHe || p.nameEn;
  return p.nameEn || p.nameAr;
}

function StatusChip({
  count,
  label,
  soft,
  ink,
  isRTL,
}: {
  count: number;
  label: string;
  soft: string;
  ink: string;
  isRTL: boolean;
}) {
  if (count <= 0) return null;
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: soft,
        borderWidth: 1,
        borderColor: ink,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: ink,
        }}
      />
      <AppText
        variant="caption"
        weight="semibold"
        numberOfLines={1}
        style={{ color: ink, fontSize: 11 }}
      >
        {count} {label}
      </AppText>
    </View>
  );
}

/**
 * Order-level SEMI board card — IndustrialFloorTaskCard anatomy:
 * header band, media crop, identity, status chips.
 */
export function InventorySemiOrderGroupCard({
  order,
  index = 0,
  animateEnter = true,
  onPress,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = productName(order, locale);
  const mediaUri = resolveOrderMediaUri(order.product?.imageUrl);
  const { counts } = order;
  const fadeBottom = colorScheme === 'dark' ? 0.72 : 0.58;
  const stageNames = Array.from(
    new Set(
      order.kits.map((kit) => {
        const s = kit.stageInstance.stageDefinition;
        if (locale === 'ar') return s.nameAr || s.nameEn;
        if (locale === 'he') return s.nameHe || s.nameEn;
        return s.nameEn;
      }).filter(Boolean),
    ),
  );
  const stagesLine =
    stageNames.length > 0
      ? t('mobile.inventory.semiOrderStagesLine', {
          stages: stageNames.slice(0, 2).join(locale === 'ar' || locale === 'he' ? '، ' : ', '),
        })
      : null;

  const dominant =
    counts.atStation > 0
      ? 'station'
      : counts.inWarehouse > 0
        ? 'warehouse'
        : counts.received > 0
          ? 'received'
          : 'idle';

  const accent =
    dominant === 'station'
      ? colors.info
      : dominant === 'warehouse'
        ? colors.success
        : dominant === 'received'
          ? colors.warning
          : colors.brand;

  const borderColor =
    dominant === 'received' ? colors.warning : colors.borderStrong;

  return (
    <ListItemEnter index={index} enabled={animateEnter}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${order.number} ${name}`}
        onPress={() => {
          void haptics.selection();
          onPress?.();
        }}
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          marginBottom: theme.spacing.sm + 6,
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
            opacity: 0.85,
          }}
        />

        {/* Header band */}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
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
                paddingHorizontal: 9,
                paddingVertical: 4,
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
                {order.number}
              </AppText>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
                backgroundColor: colors.infoSoft,
                borderWidth: 1,
                borderColor: colors.info,
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                numberOfLines={1}
                style={{ color: colors.info, fontSize: 11 }}
              >
                {t('mobile.inventory.semiOrderProgress', {
                  active: String(counts.active),
                  total: String(counts.total),
                })}
              </AppText>
            </View>
          </View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <AppText variant="caption" color="brand" weight="semibold" numberOfLines={1}>
              {t('mobile.inventory.semiOpenOrder')}
            </AppText>
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={14}
              color={colors.brand}
            />
          </View>
        </View>

        {/* Media crop */}
        <View style={{ paddingHorizontal: theme.spacing.md, marginTop: theme.spacing.sm + 2 }}>
          <View
            style={{
              aspectRatio: MEDIA_ASPECT,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
              overflow: 'hidden',
            }}
          >
            {mediaUri ? (
              <Image
                source={{ uri: mediaUri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.brandSoft,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="layers-outline" size={22} color={colors.brand} />
                </View>
              </View>
            )}
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '44%' }}
            >
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <SvgGradient id={`semiOrderFade-${order.productionOrderId}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={colors.surface} stopOpacity="0" />
                    <Stop offset="1" stopColor={colors.surface} stopOpacity={fadeBottom} />
                  </SvgGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill={`url(#semiOrderFade-${order.productionOrderId})`}
                />
              </Svg>
            </View>
            <View
              style={{
                position: 'absolute',
                bottom: theme.spacing.sm,
                ...(isRTL ? { right: theme.spacing.sm } : { left: theme.spacing.sm }),
                maxWidth: '88%',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: theme.radius.full,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <AppText variant="caption" weight="semibold" numberOfLines={1}>
                {t('mobile.inventory.semiOrderKitCount', { count: String(counts.total) })}
              </AppText>
            </View>
          </View>
        </View>

        {/* Identity + status chips */}
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.md,
            gap: theme.spacing.sm,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
          }}
        >
          <AppText
            variant="body"
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
          {stagesLine ? (
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {stagesLine}
            </AppText>
          ) : null}

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            <StatusChip
              count={counts.inWarehouse}
              label={t('mobile.inventory.semiOrderChipWarehouse')}
              soft={colors.successSoft}
              ink={colors.success}
              isRTL={isRTL}
            />
            <StatusChip
              count={counts.received}
              label={t('mobile.inventory.semiOrderChipReceived')}
              soft={colors.warningSoft}
              ink={colors.warning}
              isRTL={isRTL}
            />
            <StatusChip
              count={counts.atStation}
              label={t('mobile.inventory.semiOrderChipStation')}
              soft={colors.infoSoft}
              ink={colors.info}
              isRTL={isRTL}
            />
            {counts.used > 0 ? (
              <StatusChip
                count={counts.used}
                label={t('mobile.inventory.semiOrderChipUsed')}
                soft={colors.surfaceSecondary}
                ink={colors.textSecondary}
                isRTL={isRTL}
              />
            ) : null}
          </View>
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}
