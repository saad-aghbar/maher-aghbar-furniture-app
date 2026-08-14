import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { formatProductionPreviewStep, localizedName } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { ProductionSetupStage } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  useProductProductionSetupPreviewQuery,
  useProductProductionSetupQuery,
  usePutProductProductionSetupMutation,
} from '@/features/workflow/query';
import { ProductionStageSetupSheet } from './components/ProductionStageSetupSheet';

type Props = {
  productId: string;
  backFallback?: Href;
};

function statusLabel(status: string, t: (key: string) => string) {
  if (status === 'READY') return t('mobile.production.workflow.setupReady');
  if (status === 'INVALID') return t('mobile.production.workflow.setupInvalid');
  return t('mobile.production.workflow.setupNeedsSetup');
}

export function ProductionSetupScreen({
  productId,
  backFallback = '/(app)/(admin)/products',
}: Props) {
  const { t, locale } = useLocale();
  const { theme, colors } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const setupQuery = useProductProductionSetupQuery(productId);
  const previewQuery = useProductProductionSetupPreviewQuery(productId);
  const saveMutation = usePutProductProductionSetupMutation(productId);
  const [editing, setEditing] = useState<ProductionSetupStage | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ProductionSetupStage>>({});

  const stages = useMemo(() => {
    return (setupQuery.data?.stages ?? []).map((s) => drafts[s.workflowNodeId] ?? s);
  }, [drafts, setupQuery.data?.stages]);

  function saveAll() {
    saveMutation.mutate(
      {
        stages: stages.map((s) => ({
          workflowNodeId: s.workflowNodeId,
          stageDefinitionId: s.stageDefinitionId,
          behavior: s.behavior,
          consumesRawMaterials: s.consumesRawMaterials,
          consumesSemiFinished: s.consumesSemiFinished,
          outputNameEn: s.output?.nameEn ?? null,
          outputNameAr: s.output?.nameAr ?? null,
          outputNameHe: s.output?.nameHe ?? null,
          outputQtyPerUnit: s.output?.qtyPerUnit ?? 1,
          defaultWarehouseId: s.output?.defaultWarehouseId ?? null,
          consumeOutputIds: s.consumeOutputIds,
        })),
      },
      {
        onSuccess: () => {
          void haptics.confirmMedium();
          setDrafts({});
          showToast({
            variant: 'success',
            message: t('mobile.production.workflow.setupSaved'),
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
      },
    );
  }

  if (setupQuery.isError && !setupQuery.data) {
    return (
      <AppScreen backFallback={backFallback}>
        <ErrorState
          title={t('mobile.production.workflow.loadError')}
          onRetry={() => void setupQuery.refetch()}
        />
      </AppScreen>
    );
  }

  const setup = setupQuery.data;
  const cardStyle = {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: theme.spacing.md,
    minHeight: 44,
  };

  return (
    <AppScreen backFallback={backFallback}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['4xl'],
        }}
        refreshControl={
          <RefreshControl
            refreshing={setupQuery.isRefetching}
            onRefresh={() => void setupQuery.refetch()}
          />
        }
      >
        <AppText variant="title">{t('mobile.production.workflow.setupTitle')}</AppText>
        <AppText variant="caption" color="muted">
          {t('production.setup.newOrdersOnly')}
        </AppText>
        {setupQuery.isPending && !setup ? (
          <ActivityIndicator color={colors.brand} />
        ) : null}
        {setup ? (
          <AppText variant="heading" weight="semibold">
            {statusLabel(setup.status, t)}
          </AppText>
        ) : null}
        {(setup?.issues ?? []).map((issue) => (
          <AppText key={issue.code} variant="caption" color="muted">
            {t(`errors.${issue.code}`) === `errors.${issue.code}`
              ? issue.message
              : t(`errors.${issue.code}`)}
          </AppText>
        ))}

        <View style={{ ...cardStyle, gap: theme.spacing.sm }}>
          <AppText variant="heading" weight="semibold">
            {t('production.setup.bomTitle')}
          </AppText>
          {(setup?.bomLines ?? []).length === 0 ? (
            <AppText variant="caption" color="muted">
              {t('production.setup.bomEmpty')}
            </AppText>
          ) : (
            (setup?.bomLines ?? []).map((line) => (
              <AppText key={line.sku} variant="caption">
                {t('production.setup.bomLine', { sku: line.sku, qty: String(line.qty) })}
              </AppText>
            ))
          )}
          <Pressable
            onPress={() => {
              void haptics.selection();
              router.push(`/(app)/(admin)/products/${productId}`);
            }}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <AppText variant="body" weight="semibold" color="brand">
              {t('production.setup.editBom')}
            </AppText>
          </Pressable>
        </View>

        {setup && stages.length === 0 ? (
          <EmptyState title={t('production.setup.previewEmpty')} />
        ) : null}

        {stages.map((stage) => (
          <Pressable
            key={stage.workflowNodeId}
            onPress={() => {
              void haptics.selection();
              setEditing(stage);
            }}
            style={{ ...cardStyle, gap: 4 }}
          >
            <AppText variant="body" weight="semibold">
              {localizedName(locale, stage)}
            </AppText>
            <AppText variant="caption" color="muted">
              {t(`production.setup.behavior${behaviorKey(stage.behavior)}`)}
            </AppText>
          </Pressable>
        ))}

        {(previewQuery.data?.steps ?? []).length ? (
          <View style={{ ...cardStyle, gap: theme.spacing.sm }}>
            <AppText variant="heading" weight="semibold">
              {t('mobile.production.workflow.setupPreview')}
            </AppText>
            {previewQuery.data?.steps.map((step, i) => (
              <AppText key={`${step.stageNameEn}-${i}`} variant="caption">
                {formatProductionPreviewStep(locale, step)}
              </AppText>
            ))}
          </View>
        ) : null}

        <PrimaryButton
          label={t('mobile.production.workflow.setupSave')}
          loading={saveMutation.isPending}
          disabled={!setup?.workflow || saveMutation.isPending}
          onPress={saveAll}
        />
      </ScrollView>

      <ProductionStageSetupSheet
        open={Boolean(editing)}
        stage={editing}
        outputs={setup?.outputs ?? []}
        warehouses={setup?.warehouses ?? []}
        onClose={() => setEditing(null)}
        onSave={(next: ProductionSetupStage) => {
          setDrafts((prev) => ({ ...prev, [next.workflowNodeId]: next }));
          setEditing(null);
        }}
      />
    </AppScreen>
  );
}

function behaviorKey(behavior: string) {
  switch (behavior) {
    case 'USES_MATERIALS':
      return 'UsesMaterials';
    case 'PRODUCES_SEMI_FINISHED':
      return 'ProducesSemi';
    case 'USES_SEMI_FINISHED':
      return 'UsesSemi';
    case 'USES_AND_PRODUCES':
      return 'UsesAndProduces';
    case 'PRODUCES_FINISHED':
      return 'ProducesFinished';
    default:
      return 'None';
  }
}
