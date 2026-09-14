import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { orderBoardShadow } from './orderFloorStyle';
import type { PlanItemFloorModel, PlanItemSectionKey } from '../selectPlanItemsFloor';

type Props = {
  item: PlanItemFloorModel;
  onPress: () => void;
};

const THUMB = 56;

const SECTION_ICON: Record<PlanItemSectionKey, keyof typeof Ionicons.glyphMap> = {
  spec: 'document-text-outline',
  materials: 'layers-outline',
  workflow: 'git-network-outline',
};

const SECTION_STAMP: Record<PlanItemSectionKey, string> = {
  spec: 'mobile.orders.journey.planStampSpec',
  materials: 'mobile.orders.journey.planStampMaterials',
  workflow: 'mobile.orders.journey.planStampWorkflow',
};

const SECTION_LABEL: Record<PlanItemSectionKey, string> = {
  spec: 'mobile.orders.journey.planSectionSpec',
  materials: 'mobile.orders.journey.planSectionMaterials',
  workflow: 'mobile.orders.journey.planSectionWorkflow',
};

/**
 * One manufacture line — materials-card recipe with plan readiness stamps.
 */
export function PlanItemFloorCard({ item, onPress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const kindLabel = t(`mobile.orders.journey.kind.${item.complexity}`);
  const accent = item.attention ? colors.warning : colors.brand;
  const qty = t('mobile.orders.journey.planItemQty', { n: item.quantity });

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={t('mobile.orders.journey.planItemOpen')}
      testID={`plan-item-${item.salesOrderLineId}`}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: item.attention ? colors.warning : colors.borderStrong,
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
          width: 3,
          backgroundColor: accent,
          opacity: item.attention ? 0.9 : 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
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
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
          }}
        >
          <View
            style={{
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 2,
              borderRadius: theme.radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.brand,
            }}
          >
            <AppText
              variant="caption"
              weight={titleWeight}
              numberOfLines={1}
              style={{ color: colors.brand, fontSize: 10, lineHeight: 12 }}
            >
              {kindLabel}
            </AppText>
          </View>
          {item.needsWorkflow ? (
            <AppText
              variant="caption"
              weight={titleWeight}
              numberOfLines={1}
              style={{ color: colors.warning, fontSize: 11, flexShrink: 1 }}
            >
              {t('mobile.orders.journey.planNeedsWorkflow')}
            </AppText>
          ) : null}
        </View>
        <AppText variant="caption" color="brand" weight={titleWeight}>
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
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          <ProductThumb uri={item.imageUrl} size={THUMB} radius={theme.radius.md} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 16 }}
            >
              {item.title}
            </AppText>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                flexWrap: 'wrap',
              }}
            >
              {item.sku ? (
                <AppText
                  variant="caption"
                  color="muted"
                  numberOfLines={1}
                  dir="ltr"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {item.sku}
                </AppText>
              ) : null}
              <View
                style={{
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: 2,
                  borderRadius: theme.radius.md,
                  backgroundColor: colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <AppText
                  variant="caption"
                  weight={titleWeight}
                  dir="ltr"
                  style={{ color: colors.textSecondary, fontSize: 11 }}
                >
                  {qty}
                </AppText>
              </View>
            </View>
            {item.fabricLabel ? (
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={1}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('mobile.orderDetail.fabric')}: {item.fabricLabel}
              </AppText>
            ) : null}
          </View>
        </View>

        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
            padding: theme.spacing.sm,
          }}
        >
          {item.sections.map((section) => {
            const stamp = t(SECTION_STAMP[section.key]);
            const label = t(SECTION_LABEL[section.key]);
            const fill = section.alert
              ? colors.warningSoft
              : section.done
                ? colors.brandSoft
                : colors.surface;
            const stroke = section.alert
              ? colors.warning
              : section.done
                ? colors.brand
                : colors.border;
            const ink = section.alert
              ? colors.warning
              : section.done
                ? colors.brand
                : colors.textMuted;
            const bar = section.alert
              ? colors.warning
              : section.done
                ? colors.brand
                : 'transparent';

            return (
              <View
                key={section.key}
                accessibilityLabel={label}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 40,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: stroke,
                  backgroundColor: fill,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: 4,
                  overflow: 'hidden',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {bar !== 'transparent' ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 3,
                      backgroundColor: bar,
                    }}
                  />
                ) : null}
                <Ionicons name={SECTION_ICON[section.key]} size={13} color={ink} />
                <AppText
                  variant="caption"
                  weight={titleWeight}
                  numberOfLines={1}
                  align="center"
                  style={{
                    fontSize: 10,
                    lineHeight: 12,
                    letterSpacing: locale === 'ar' ? 0 : 0.4,
                    textTransform: locale === 'ar' ? 'none' : 'uppercase',
                    color: ink,
                  }}
                >
                  {stamp}
                </AppText>
              </View>
            );
          })}
        </View>
      </View>
    </AnimatedPressable>
  );
}
