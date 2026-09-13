import { Image, ScrollView, View } from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { manufacturingComplexityDisplayKey } from '@maher/types';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { EmptyProductImage } from '@/components/media/EmptyProductImage';
import { AppScreen } from '@/components/layout/AppScreen';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { lineVisualIdentity } from '@maher/types';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { OrderProductionSetupLine } from './api';

type Props = {
  salesOrderId: string;
  lines: OrderProductionSetupLine[];
};

export function OrderProductionPlanItemBoard({ salesOrderId, lines }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <AppScreen edges={{ top: true, bottom: true }} style={{ paddingHorizontal: 0 }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <BackButton onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <AppText variant="largeTitle" weight={titleWeight}>
            {t('mobile.orders.journey.planItemsTitle')}
          </AppText>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing['3xl'],
        }}
      >
        {lines.map((line, index) => {
          const kind = manufacturingComplexityDisplayKey(line.manufacturingComplexity);
          const imageUri = lineVisualIdentity({
            productImageRef: line.imageUrl,
            productImageUrl: line.product?.imageUrl,
          });
          const needsWorkflow =
            String(line.manufacturingComplexity).toUpperCase() === 'CUSTOM' && !line.workflowId;
          const readyBits = [
            line.sectionProgress?.spec ? t('mobile.orders.journey.planSectionSpec') : null,
            line.sectionProgress?.materials ? t('mobile.orders.journey.planSectionMaterials') : null,
            line.workflowId
              ? t('mobile.orders.journey.planSectionWorkflow')
              : needsWorkflow
                ? t('mobile.orders.journey.planNeedsWorkflow')
                : null,
          ].filter(Boolean);
          return (
            <ListItemEnter key={line.id} index={index}>
              <DealerBoard
                title={line.manufacturingName || line.description || t('mobile.newOrder.untitledModel')}
                titleWeight={titleWeight}
              >
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('mobile.orders.journey.planItemOpen')}
                  testID={`plan-item-${line.salesOrderLineId}`}
                  onPress={() => {
                    void haptics.selection();
                    router.push(
                      `/(app)/(admin)/orders/${salesOrderId}/production-plan?lineId=${line.salesOrderLineId}` as Href,
                    );
                  }}
                  style={{ gap: theme.spacing.sm }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      gap: theme.spacing.md,
                    }}
                  >
                    <View
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: theme.radius.lg,
                        overflow: 'hidden',
                        backgroundColor: colors.surfaceSecondary,
                      }}
                    >
                      {imageUri ? (
                        <Image source={{ uri: imageUri }} style={{ width: 72, height: 72 }} />
                      ) : (
                        <EmptyProductImage />
                      )}
                    </View>
                    <View style={{ flex: 1, gap: theme.spacing.xs }}>
                      <View
                        style={{
                          alignSelf: isRTL ? 'flex-end' : 'flex-start',
                          paddingHorizontal: theme.spacing.sm,
                          paddingVertical: 4,
                          borderRadius: theme.radius.md,
                          backgroundColor: colors.warningSoft,
                          borderWidth: 1,
                          borderColor: colors.warning,
                        }}
                      >
                        <AppText variant="caption" weight="medium" style={{ color: colors.warning }}>
                          {t(`mobile.lineKind.${kind}`)}
                        </AppText>
                      </View>
                      <AppText variant="caption" color="muted">
                        {line.product?.sku || t('mobile.newOrder.defaultVariant')}
                      </AppText>
                      <AppText variant="caption">
                        × {line.quantity}
                      </AppText>
                      {line.requestedFabricLabel ? (
                        <AppText variant="caption" color="muted">
                          {t('mobile.orderDetail.fabric')}: {line.requestedFabricLabel}
                        </AppText>
                      ) : null}
                      <AppText variant="caption" color="secondary">
                        {readyBits.join(' · ')}
                      </AppText>
                    </View>
                  </View>
                </AnimatedPressable>
              </DealerBoard>
            </ListItemEnter>
          );
        })}
      </ScrollView>
    </AppScreen>
  );
}
