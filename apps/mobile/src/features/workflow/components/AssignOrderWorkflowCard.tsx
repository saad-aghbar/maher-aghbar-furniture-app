import { useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { WorkflowScope } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useToast } from '@/components/feedback/Toast';
import { MoreBoard } from '@/features/more/components/MoreBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { useAssignOrderWorkflowMutation, useWorkflowsQuery } from '@/features/workflow/query';
import { WorkflowPickDesk } from './WorkflowPickDesk';

type Props = {
  productionOrderId: string;
  preferredScope?: WorkflowScope;
};

export function AssignOrderWorkflowCard({ productionOrderId, preferredScope }: Props) {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const workflowsQuery = useWorkflowsQuery(true);
  const assignMutation = useAssignOrderWorkflowMutation(productionOrderId);

  return (
    <MoreBoard
      style={{
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
      }}
    >
      <AppText variant="body" weight={titleWeight}>
        {t('mobile.production.workflow.needsWorkflowTitle')}
      </AppText>
      <AppText variant="caption" color="muted">
        {t('mobile.production.workflow.needsWorkflowBody')}
      </AppText>

      <WorkflowPickDesk
        embedded
        workflows={workflowsQuery.data ?? []}
        selectedId={selectedId}
        preferredScope={preferredScope}
        initialScope={preferredScope ?? null}
        loading={workflowsQuery.isLoading}
        onSelect={setSelectedId}
      />

      <PrimaryButton
        label={t('mobile.production.workflow.assignWorkflow')}
        loading={assignMutation.isPending}
        disabled={!selectedId || assignMutation.isPending}
        haptic="selection"
        style={{ borderRadius: theme.radius.xl }}
        onPress={() => {
          if (!selectedId) return;
          assignMutation.mutate(selectedId, {
            onSuccess: () => {
              void haptics.confirmLight();
              showToast({
                variant: 'success',
                message: t('mobile.production.workflow.workflowAssignedSetTimes'),
              });
            },
            onError: (err) => {
              void haptics.error();
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

      <AnimatedPressable
        variant="button"
        onPress={() => {
          void haptics.selection();
          router.push('/(app)/(admin)/production/workflow' as Href);
        }}
        style={{ alignItems: 'center', paddingVertical: theme.spacing.sm, minHeight: theme.sizes.touch.min }}
      >
        <AppText variant="body" weight={titleWeight} color="brand">
          {t('mobile.production.workflow.createWorkflowThenAssign')}
        </AppText>
      </AnimatedPressable>
    </MoreBoard>
  );
}
