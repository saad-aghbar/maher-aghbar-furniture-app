import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { ProgressBar } from '@/motion';
import { useTheme } from '@/theme';
import type { ProductionFlowModel, ProductionFlowStage } from '../selectProductionFlow';
import { isStageStatusComplete, StageWorkPhotos } from './StageWorkPhotos';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

type Props = {
  open: boolean;
  onClose: () => void;
  stage: ProductionFlowStage | null;
  flow: ProductionFlowModel;
};

/**
 * Dealer-safe stage sheet — same production aesthetic, dealer-visible fields only.
 */
export function DealerStageSheet({ open, onClose, stage, flow }: Props) {
  const { t, formatDate, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const completed = stage ? isStageStatusComplete(stage.status) : false;
  const pct = stage
    ? Math.max(0, Math.min(100, Math.round(stage.progressPercent || 0)))
    : 0;
  const accent =
    stage?.status === 'IN_PROGRESS'
      ? colors.brand
      : completed
        ? colors.success
        : colors.borderStrong;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const bottomPad = insets.bottom + theme.spacing.md;

  return (
    <BottomSheet
      open={open && Boolean(stage)}
      onClose={onClose}
      title={stage?.name ?? t('mobile.productionFlow.stageDetails')}
      fitContent
    >
      {stage ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: bottomPad,
          }}
        >
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
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
                backgroundColor: accent,
                opacity: 0.55,
              }}
            />
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.spacing.sm,
                ...(isRTL ? { paddingRight: 4 } : { paddingLeft: 4 }),
              }}
            >
              <StatusBadge status={stage.status} dot />
            </View>
            <View
              style={{
                gap: theme.spacing.xs,
                ...(isRTL ? { paddingRight: 4 } : { paddingLeft: 4 }),
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <AppText variant="caption" color="secondary">
                  {t('mobile.production.progress')}
                </AppText>
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: accent }}
                  dir="ltr"
                >
                  {`${pct}%`}
                </AppText>
              </View>
              <ProgressBar
                progress={pct / 100}
                height={5}
                fillStyle={{ backgroundColor: accent }}
                trackStyle={{ backgroundColor: colors.surface }}
              />
            </View>
          </View>

          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <Ionicons name="images-outline" size={16} color={colors.brand} />
              <AppText variant="caption" color="muted">
                {t('mobile.productionFlow.workPhotos')}
              </AppText>
            </View>
            <StageWorkPhotos
              photos={stage.photos}
              stageCompleted={completed}
              hideTitle
            />
          </View>

          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
            }}
          >
            <AppText variant="caption" color="muted">
              {t('mobile.productionFlow.overallProgress')}
            </AppText>
            <AppText variant="title" weight={titleWeight} style={{ color: colors.brand }}>
              {Math.round(flow.progressPercent)}%
            </AppText>
            <ProgressBar
              progress={Math.max(0, Math.min(100, flow.progressPercent)) / 100}
              height={5}
            />
          </View>

          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.brand} />
              <AppText variant="caption" color="muted">
                {t('mobile.productionFlow.estimatedDelivery')}
              </AppText>
            </View>
            <AppText variant="body" weight={titleWeight}>
              {flow.estimatedDelivery
                ? formatDate(flow.estimatedDelivery)
                : t('mobile.productionFlow.deliveryTbd')}
            </AppText>
          </View>
        </ScrollView>
      ) : null}
    </BottomSheet>
  );
}
