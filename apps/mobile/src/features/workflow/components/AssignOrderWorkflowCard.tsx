import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { localizedName } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { WorkflowScope } from '@/api/modules/workflow';
import { useAssignOrderWorkflowMutation, useWorkflowsQuery } from '@/features/workflow/query';
import { workflowScopeLabelKey } from '@/features/workflow/workflowScope';
import { WorkflowFloorBoard, WorkflowFloorRow } from './WorkflowFloorList';

type Props = {
  productionOrderId: string;
  preferredScope?: WorkflowScope;
};

export function AssignOrderWorkflowCard({ productionOrderId, preferredScope }: Props) {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const workflowsQuery = useWorkflowsQuery(true);
  const assignMutation = useAssignOrderWorkflowMutation(productionOrderId);

  const filtered = useMemo(() => {
    const rows = (workflowsQuery.data ?? [])
      .filter((wf) => Boolean(wf.activeVersion))
      .sort((a, b) => {
        if (!preferredScope) return 0;
        const aMatch = (a.scope ?? 'STANDARD') === preferredScope ? 0 : 1;
        const bMatch = (b.scope ?? 'STANDARD') === preferredScope ? 0 : 1;
        return aMatch - bMatch;
      });
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((wf) => {
      const name = localizedName(locale, wf, wf.code).toLowerCase();
      return name.includes(q) || wf.code.toLowerCase().includes(q);
    });
  }, [locale, preferredScope, query, workflowsQuery.data]);

  return (
    <View style={{ gap: theme.spacing.md }}>
      <AppText variant="body" weight="semibold">
        {t('mobile.production.workflow.needsWorkflowTitle')}
      </AppText>
      <AppText variant="caption" color="muted">
        {t('mobile.production.workflow.needsWorkflowBody')}
      </AppText>

      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder={t('mobile.production.workflow.searchWorkflows')}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <ScrollView
        style={{ maxHeight: 260 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <WorkflowFloorBoard
          title={t('mobile.production.workflow.title')}
          count={filtered.length}
        >
          {filtered.map((wf) => {
            const active = selectedId === wf.id;
            return (
              <WorkflowFloorRow
                key={wf.id}
                label={localizedName(locale, wf, wf.code)}
                meta={[
                  t(workflowScopeLabelKey(wf.scope)),
                  wf.activeVersion
                    ? t('mobile.production.workflow.cardMeta', {
                        version: wf.activeVersion.versionNumber,
                        stages: wf.activeVersion._count?.nodes ?? 0,
                      })
                    : t('mobile.production.workflow.draftVersion'),
                ].join(' · ')}
                active={active}
                showChevron={false}
                onPress={() => {
                  void haptics.selection();
                  setSelectedId(wf.id);
                }}
              />
            );
          })}
          {!workflowsQuery.isLoading && filtered.length === 0 ? (
            <AppText color="muted">{t('mobile.production.workflow.noWorkflowMatches')}</AppText>
          ) : null}
        </WorkflowFloorBoard>
      </ScrollView>

      <PrimaryButton
        label={t('mobile.production.workflow.assignWorkflow')}
        loading={assignMutation.isPending}
        disabled={!selectedId || assignMutation.isPending}
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
        style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}
      >
        <AppText variant="body" weight="semibold" color="brand">
          {t('mobile.production.workflow.createWorkflowThenAssign')}
        </AppText>
      </AnimatedPressable>
    </View>
  );
}
