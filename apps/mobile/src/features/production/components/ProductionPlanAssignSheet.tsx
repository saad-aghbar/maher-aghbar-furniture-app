import { ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

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
  onAssignStage: (taskId: string) => void;
  onRetryPrepare?: () => void;
  prepareFailed?: boolean;
};

/**
 * Production Plan assign sheet — lists all executable stages for this PO.
 * Opens from the floating "Assign workers & dates" CTA.
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
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <BottomSheet open={open} onClose={onClose} title={title} fitContent>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}
      >
        {subtitle ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {subtitle}
          </AppText>
        ) : null}

        {prepareFailed ? (
          <View
            style={{
              gap: theme.spacing.sm,
              padding: theme.spacing.md,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.error,
              backgroundColor: colors.errorSoft,
            }}
          >
            <AppText variant="body" weight="semibold" style={{ color: colors.error }}>
              {t('mobile.production.setup.stagesPrepareFailed')}
            </AppText>
            {onRetryPrepare ? (
              <SecondaryButton
                label={t('mobile.production.retry')}
                onPress={onRetryPrepare}
                loading={loading}
              />
            ) : null}
          </View>
        ) : null}

        {!prepareFailed && stages.length === 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="caption" color="muted">
              {t('mobile.production.setup.noExecutableTasks')}
            </AppText>
            {onRetryPrepare ? (
              <SecondaryButton
                label={t('mobile.production.setup.retryPrepareStages')}
                onPress={onRetryPrepare}
                loading={loading}
              />
            ) : null}
          </View>
        ) : null}

        {stages.map((stage) => (
          <View
            key={stage.taskId}
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceElevated,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
            }}
          >
            {stage.dependsOnCodes.length > 0 ? (
              <AppText variant="caption" color="brand">
                {t('mobile.production.setup.parallelBand', {
                  deps: stage.dependsOnCodes.join(' · '),
                })}
              </AppText>
            ) : null}
            <AppText
              variant="body"
              weight="semibold"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {stage.name}
            </AppText>
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
            {canAssign && stage.canAssign ? (
              <PrimaryButton
                label={
                  stage.assigneeName
                    ? t('mobile.production.reassignWorker')
                    : t('mobile.production.assignWorker')
                }
                onPress={() => onAssignStage(stage.taskId)}
              />
            ) : null}
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}
