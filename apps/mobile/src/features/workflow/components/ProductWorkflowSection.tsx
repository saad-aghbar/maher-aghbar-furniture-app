import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { stageEstimateMinutes } from '@/api/modules/scheduling';
import { AppText } from '@/components/AppText';
import { useToast } from '@/components/feedback/Toast';
import {
  useProductProductionProfileQuery,
  useProductStageEstimatesQuery,
} from '@/features/scheduling/productEstimates';
import { formatMinutesDuration } from '@/features/tasks/formatDuration';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  useProductWorkflowQuery,
  useUpsertProductWorkflowMutation,
  useWorkflowsQuery,
} from '@/features/workflow/query';
import { WorkflowPickDesk } from './WorkflowPickDesk';

type Props = {
  productId: string;
  showHeading?: boolean;
  titleWeight?: 'regular' | 'medium' | 'semibold';
};

export function ProductWorkflowSection({
  productId,
  showHeading = true,
  titleWeight = 'semibold',
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme, colors } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const headingWeight = titleWeight === 'semibold' && locale === 'ar' ? 'medium' : titleWeight;
  const workflowsQuery = useWorkflowsQuery(true);
  const configQuery = useProductWorkflowQuery(productId);
  const upsertMutation = useUpsertProductWorkflowMutation(productId);
  const profileQuery = useProductProductionProfileQuery(productId);
  const estimatesQuery = useProductStageEstimatesQuery(productId);

  const selectedId = configQuery.data?.workflowId ?? null;

  const totalMinutes = useMemo(() => {
    if (profileQuery.data?.totalStandardMinutes != null) {
      return Number(profileQuery.data.totalStandardMinutes);
    }
    return (estimatesQuery.data ?? []).reduce((sum, row) => sum + stageEstimateMinutes(row), 0);
  }, [estimatesQuery.data, profileQuery.data?.totalStandardMinutes]);

  const missingEstimateCount = useMemo(() => {
    const timed = new Set(
      (estimatesQuery.data ?? [])
        .filter((row) => stageEstimateMinutes(row) > 0)
        .map((row) => row.stageDefinitionId),
    );
    const wf = (workflowsQuery.data ?? []).find((w) => w.id === selectedId);
    const nodeCount = wf?.activeVersion?._count?.nodes ?? 0;
    if (!selectedId || nodeCount === 0) return 0;
    return Math.max(0, nodeCount - timed.size);
  }, [estimatesQuery.data, selectedId, workflowsQuery.data]);

  function openProductionSetup() {
    router.push(`/(app)/(admin)/products/${productId}/production-setup`);
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      {showHeading ? (
        <View style={{ gap: 4 }}>
          <AppText variant="body" weight={headingWeight}>
            {t('mobile.production.workflow.productSectionTitle')}
          </AppText>
          <AppText variant="caption" color="muted">
            {t('mobile.production.workflow.productSectionHint')}
          </AppText>
        </View>
      ) : (
        <AppText variant="caption" color="muted">
          {t('mobile.production.workflow.productSectionHint')}
        </AppText>
      )}

      {selectedId ? (
        <Pressable
          onPress={() => {
            void haptics.selection();
            openProductionSetup();
          }}
          style={({ pressed }) => ({
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.md,
            opacity: pressed ? 0.88 : 1,
            gap: 4,
          })}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" color="muted">
                {t('mobile.production.workflow.totalProductionTime')}
              </AppText>
              <AppText variant="body" weight={headingWeight}>
                {totalMinutes > 0
                  ? formatMinutesDuration(totalMinutes, {
                      hour: t('mobile.workerHome.durationHour'),
                      minute: t('mobile.workerHome.durationMinute'),
                    })
                  : t('mobile.production.workflow.noProductionTimeYet')}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('mobile.production.workflow.openWorkflowChart')}
              </AppText>
              {missingEstimateCount > 0 ? (
                <AppText variant="caption" style={{ color: colors.error }}>
                  {t('mobile.production.workflow.stagesNeedTime', { count: missingEstimateCount })}
                </AppText>
              ) : null}
            </View>
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={20}
              color={colors.textSecondary}
            />
          </View>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => {
          void haptics.selection();
          router.push(`/(app)/(admin)/products/${productId}/production-setup`);
        }}
        style={({ pressed }) => ({
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.md,
          opacity: pressed ? 0.88 : 1,
          gap: 4,
        })}
      >
        <AppText variant="body" weight={headingWeight}>
          {t('mobile.production.workflow.openProductionSetup')}
        </AppText>
        <AppText variant="caption" color="muted">
          {t('mobile.production.workflow.openProductionSetupHint')}
        </AppText>
      </Pressable>

      <WorkflowPickDesk
        workflows={workflowsQuery.data ?? []}
        selectedId={selectedId}
        selectAgain
        loading={workflowsQuery.isLoading || configQuery.isLoading}
        onSelect={(id) => {
          if (id === selectedId) {
            openProductionSetup();
            return;
          }
          upsertMutation.mutate(id, {
            onSuccess: () => {
              showToast({
                variant: 'success',
                message: t('mobile.production.workflow.productWorkflowSaved'),
              });
            },
            onError: (err) => {
              showToast({
                variant: 'error',
                message: isApiError(err)
                  ? toastMessageForError(err)
                  : t('mobile.production.workflow.loadError'),
              });
            },
          });
        }}
      />
    </View>
  );
}
