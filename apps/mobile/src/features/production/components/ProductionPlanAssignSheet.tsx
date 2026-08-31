import { ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { productionInsetStyle } from '../productionFloorStyle';

export type PlanStageRow = {
  taskId: string;
  name: string;
  assigneeName: string | null;
  plannedLabel: string | null;
  canAssign: boolean;
  dependsOnCodes: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  stages: PlanStageRow[];
  loading?: boolean;
  canAssign: boolean;
  /** Opens the task desk (worker + dates) for this task. */
  onAssignStage: (taskId: string) => void;
  onRetryPrepare?: () => void;
  prepareFailed?: boolean;
};

/**
 * Production Plan sheet — lists executable tasks; tap a row to edit worker/dates.
 */
export function ProductionPlanAssignSheet({
  open,
  onClose,
  title,
  subtitle,
  stages,
  loading,
  canAssign,
  onAssignStage,
  onRetryPrepare,
  prepareFailed,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <BottomSheet open={open} onClose={onClose} title={title} fitContent>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}
      >
        {subtitle ? (
          <DealerBoard titleWeight={titleWeight}>
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {subtitle}
            </AppText>
          </DealerBoard>
        ) : null}

        {prepareFailed ? (
          <DealerBoard
            title={t('mobile.production.setup.stagesPrepareFailed')}
            titleWeight={titleWeight}
            accentColor={colors.error}
          >
            {onRetryPrepare ? (
              <SecondaryButton
                label={t('mobile.production.retry')}
                onPress={onRetryPrepare}
                loading={loading}
                style={{
                  borderRadius: theme.radius.full,
                  minHeight: theme.sizes.touch.min,
                }}
              />
            ) : null}
          </DealerBoard>
        ) : null}

        {!prepareFailed && stages.length === 0 ? (
          <DealerBoard titleWeight={titleWeight}>
            <AppText variant="caption" color="muted">
              {t('mobile.production.setup.noExecutableTasks')}
            </AppText>
            {onRetryPrepare ? (
              <SecondaryButton
                label={t('mobile.production.setup.retryPrepareStages')}
                onPress={onRetryPrepare}
                loading={loading}
                style={{
                  borderRadius: theme.radius.full,
                  minHeight: theme.sizes.touch.min,
                }}
              />
            ) : null}
          </DealerBoard>
        ) : null}

        {stages.map((stage) => {
          const canOpen = canAssign && stage.canAssign;
          return (
            <AnimatedPressable
              key={stage.taskId}
              variant="card"
              disabled={!canOpen}
              accessibilityRole="button"
              accessibilityLabel={stage.name}
              onPress={() => {
                if (!canOpen) return;
                void haptics.selection();
                onAssignStage(stage.taskId);
              }}
            >
              <DealerBoard title={stage.name} titleWeight={titleWeight}>
                <View style={productionInsetStyle(theme, colors)}>
                  {stage.dependsOnCodes.length > 0 ? (
                    <AppText variant="caption" color="brand">
                      {t('mobile.production.setup.parallelBand', {
                        deps: stage.dependsOnCodes.join(' · '),
                      })}
                    </AppText>
                  ) : null}
                  <AppText
                    variant="caption"
                    color={stage.assigneeName ? 'secondary' : 'muted'}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {stage.assigneeName
                      ? t('mobile.production.assignee', { name: stage.assigneeName })
                      : t('mobile.production.unassigned')}
                  </AppText>
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {stage.plannedLabel
                      ? `${t('mobile.production.plannedDate')}: ${stage.plannedLabel}`
                      : t('mobile.production.setup.dateNotPlanned')}
                  </AppText>
                  {canOpen ? (
                    <AppText variant="caption" color="brand" style={{ marginTop: 4 }}>
                      {t('mobile.production.setup.tapTaskToEdit')}
                    </AppText>
                  ) : null}
                </View>
              </DealerBoard>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}
