import { ScrollView, View } from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useSurfaceClearance } from '@/adaptive/useSurfaceClearance';
import { useTheme } from '@/theme';
import type { OrderProductionSetupLine } from './api';
import { PlanItemFloorCard } from './components/PlanItemFloorCard';
import { selectPlanItemsFloor } from './selectPlanItemsFloor';

type Props = {
  salesOrderId: string;
  lines: OrderProductionSetupLine[];
  orderNumber?: string | null;
  dealer?: {
    name?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    code?: string | null;
  } | null;
  progress?: {
    readyLines?: number;
    totalLines?: number;
    percent?: number;
  } | null;
  selectedLineId?: string;
  onSelectLine?: (lineId: string) => void;
  embedded?: boolean;
};

function PlanItemsScreenTitle({
  onBack,
  titleWeight,
}: {
  onBack: () => void;
  titleWeight: 'medium' | 'semibold';
}) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          zIndex: 1,
          justifyContent: 'center',
        }}
      >
        <BackButton onPress={onBack} />
      </View>
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
      >
        {t('mobile.orders.journey.planItemsTitle')}
      </AppText>
    </View>
  );
}

export function OrderProductionPlanItemBoard({
  salesOrderId,
  lines,
  orderNumber,
  dealer,
  progress,
  selectedLineId,
  onSelectLine,
  embedded = false,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const surfaceClearance = useSurfaceClearance();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const floor = selectPlanItemsFloor({
    orderNumber,
    dealer,
    progress,
    lines,
    locale,
  });

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      <View style={{ paddingHorizontal: theme.spacing.lg }}>
        {embedded ? null : (
          <PlanItemsScreenTitle onBack={() => router.back()} titleWeight={titleWeight} />
        )}
      </View>
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: surfaceClearance,
        }}
      >
        <ListItemEnter index={0}>
          <DealerBoard
            title={t('mobile.orders.journey.planReadinessTitle')}
            titleWeight={titleWeight}
            trailing={
              floor.orderNumber ? (
                <AppText
                  variant="caption"
                  weight={titleWeight}
                  dir="ltr"
                  numberOfLines={1}
                  style={{ color: colors.brand }}
                >
                  {floor.orderNumber}
                </AppText>
              ) : undefined
            }
          >
            <View
              style={{
                borderRadius: theme.radius.lg,
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}
            >
              {floor.dealerName ? (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.spacing.md,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm + 2,
                  }}
                >
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{
                      textTransform: locale === 'en' ? 'uppercase' : 'none',
                      letterSpacing: locale === 'en' ? 0.5 : 0,
                      fontSize: 10,
                      flexShrink: 0,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {t('mobile.orders.dealer')}
                  </AppText>
                  <AppText
                    weight={titleWeight}
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: isRTL ? 'left' : 'right',
                    }}
                  >
                    {floor.dealerName}
                  </AppText>
                </View>
              ) : null}
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm + 2,
                  borderTopWidth: floor.dealerName ? 1 : 0,
                  borderTopColor: colors.border,
                }}
              >
                <AppText
                  variant="caption"
                  color="muted"
                  style={{
                    textTransform: locale === 'en' ? 'uppercase' : 'none',
                    letterSpacing: locale === 'en' ? 0.5 : 0,
                    fontSize: 10,
                    flexShrink: 0,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {t('mobile.orders.journey.itemsCount', { count: floor.itemCount })}
                </AppText>
                <AppText
                  weight={titleWeight}
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    color: colors.brand,
                    textAlign: isRTL ? 'left' : 'right',
                  }}
                >
                  {t('mobile.orders.journey.planReadyOf', {
                    ready: floor.readyCount,
                    total: floor.itemCount,
                  })}
                </AppText>
              </View>
            </View>
            <View style={{ gap: theme.spacing.xs }}>
              <AppText
                variant="caption"
                color="muted"
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  fontSize: 10,
                  letterSpacing: locale === 'en' ? 0.45 : 0,
                  textTransform: locale === 'en' ? 'uppercase' : 'none',
                }}
              >
                {t('mobile.orders.journey.linesToManufactureHint')}
              </AppText>
              <WorkflowProgressHit
                progressPercent={floor.progressPercent}
                height={5}
                accessibilityLabel={t('mobile.orders.progress')}
              />
            </View>
          </DealerBoard>
        </ListItemEnter>

        {floor.items.length ? (
          floor.items.map((item, index) => (
            <ListItemEnter key={item.id} index={index + 1}>
              <PlanItemFloorCard
                item={item}
                selected={item.salesOrderLineId === selectedLineId}
                onPress={() => {
                  if (onSelectLine) {
                    onSelectLine(item.salesOrderLineId);
                    return;
                  }
                  router.push(
                    `/(app)/(admin)/orders/${salesOrderId}/production-plan?lineId=${item.salesOrderLineId}` as Href,
                  );
                }}
              />
            </ListItemEnter>
          ))
        ) : (
          <ListItemEnter index={1}>
            <DealerEmptyPanel text={t('mobile.orders.journey.linesToManufactureHint')} />
          </ListItemEnter>
        )}
      </ScrollView>
    </AppScreen>
  );
}
