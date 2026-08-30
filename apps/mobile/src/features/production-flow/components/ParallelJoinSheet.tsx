import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable } from '@/motion';
import { useTheme } from '@/theme';
import type { ProductionFlowStage } from '../selectProductionFlow';
import { joinHubProgress } from '../parallelJoinLayout';

type Props = {
  open: boolean;
  onClose: () => void;
  feederStages: ProductionFlowStage[];
  preview?: boolean;
  onFeederPress?: (stage: ProductionFlowStage) => void;
};

function stagePercent(stage: ProductionFlowStage): number {
  const status = (stage.status ?? '').toUpperCase();
  if (status === 'COMPLETED' || status === 'DONE' || status === 'SKIPPED') return 100;
  return Math.max(0, Math.min(100, Math.round(stage.progressPercent ?? 0)));
}

export function ParallelJoinSheet({
  open,
  onClose,
  feederStages,
  preview = false,
  onFeederPress,
}: Props) {
  const { t, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const map = new Map(feederStages.map((s) => [s.code, s]));
  const { percent, allDone } = joinHubProgress(
    feederStages.map((s) => s.code),
    map,
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.productionFlow.joinSheetTitle')}
      fitContent
    >
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
        <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
          {t('mobile.productionFlow.joinSheetHint')}
        </AppText>

        {!preview ? (
          <View
            style={{
              alignItems: 'center',
              gap: theme.spacing.xs,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: allDone ? colors.success : colors.borderStrong,
              backgroundColor: allDone ? colors.successSoft : colors.brandSoft,
            }}
          >
            <AppText
              variant="title"
              weight="semibold"
              dir="ltr"
              style={{ color: allDone ? colors.success : colors.brand, fontSize: 28 }}
            >
              {`${percent}%`}
            </AppText>
            <AppText
              variant="caption"
              weight="medium"
              style={{ color: allDone ? colors.success : colors.brand }}
            >
              {t('mobile.productionFlow.joinProgress', { percent })}
            </AppText>
          </View>
        ) : null}

        <AppText
          variant="caption"
          weight="medium"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.productionFlow.joinFeedersHeading')}
        </AppText>

        <View style={{ gap: theme.spacing.sm }}>
          {feederStages.map((stage) => {
            const pct = stagePercent(stage);
            const done = pct >= 100;
            const status = (stage.status ?? '').toUpperCase();
            const inner = (
              <View
                style={{
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surfaceSecondary,
                  paddingVertical: theme.spacing.sm + 2,
                  paddingHorizontal: theme.spacing.md,
                  gap: 6,
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText
                    variant="label"
                    weight="semibold"
                    numberOfLines={1}
                    style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {stage.name}
                  </AppText>
                  {!preview ? (
                    <AppText
                      variant="label"
                      weight="semibold"
                      dir="ltr"
                      style={{ color: done ? colors.success : colors.brand }}
                    >
                      {`${pct}%`}
                    </AppText>
                  ) : null}
                </View>
                {!preview && status ? (
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
                  >
                    {status.replace(/_/g, ' ')}
                  </AppText>
                ) : null}
                {!preview ? (
                  <View
                    style={{
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: colors.border,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: done ? colors.success : colors.brand,
                      }}
                    />
                  </View>
                ) : null}
              </View>
            );

            if (!onFeederPress || preview) {
              return <View key={stage.code}>{inner}</View>;
            }
            return (
              <AnimatedPressable
                key={stage.code}
                variant="button"
                onPress={() => {
                  onFeederPress(stage);
                  onClose();
                }}
              >
                {inner}
              </AnimatedPressable>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}
