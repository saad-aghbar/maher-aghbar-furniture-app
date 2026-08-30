import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatProductionPreviewStep, localizedName } from '@maher/i18n';
import { getAdminProduct } from '@/api/modules/catalogAdmin';
import { getInventoryItemByCode } from '@/api/modules/inventory';
import { isApiError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
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
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useTheme } from '@/theme';
import {
  useProductProductionSetupPreviewQuery,
  useProductProductionSetupQuery,
  usePutProductProductionSetupMutation,
} from '@/features/workflow/query';
import { ProductionStageSetupSheet } from './components/ProductionStageSetupSheet';
import { WorkflowStatusPill } from './components/WorkflowPageHeader';
import {
  productionSetupIssueText,
  productionSetupProductLine,
} from './productionSetupCopy';

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
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setupQuery = useProductProductionSetupQuery(productId);
  const previewQuery = useProductProductionSetupPreviewQuery(productId);
  const productQuery = useQuery({
    queryKey: queryKeys.catalog.adminDetail(productId),
    queryFn: () => getAdminProduct(productId),
    enabled: Boolean(productId),
    staleTime: 30_000,
  });
  const saveMutation = usePutProductProductionSetupMutation(productId);
  const [editing, setEditing] = useState<ProductionSetupStage | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ProductionSetupStage>>({});

  const stages = useMemo(() => {
    return (setupQuery.data?.stages ?? []).map((s) => drafts[s.workflowNodeId] ?? s);
  }, [drafts, setupQuery.data?.stages]);

  const bomSkus = useMemo(
    () =>
      (setupQuery.data?.bomLines ?? [])
        .map((line) => line.sku)
        .filter((sku): sku is string => Boolean(sku)),
    [setupQuery.data?.bomLines],
  );

  const photoQueries = useQueries({
    queries: bomSkus.map((sku) => ({
      queryKey: [...queryKeys.inventory.details(), 'by-code', sku] as const,
      queryFn: async () => {
        try {
          return await getInventoryItemByCode(sku);
        } catch {
          return null;
        }
      },
      staleTime: 60_000,
      retry: false,
    })),
  });

  const photoBySku = useMemo(() => {
    const map = new Map<string, string>();
    bomSkus.forEach((sku, i) => {
      const uri = resolveOrderMediaUri(photoQueries[i]?.data?.imageUrl);
      if (uri) map.set(sku, uri);
    });
    return map;
  }, [bomSkus, photoQueries]);

  const productBomBySku = useMemo(() => {
    const map = new Map<string, { nameEn: string; nameAr: string }>();
    for (const line of productQuery.data?.bomLines ?? []) {
      if (line.sku) map.set(line.sku, line);
    }
    return map;
  }, [productQuery.data?.bomLines]);

  const productLine = productionSetupProductLine(productQuery.data, locale);

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
  /** Sit above the floating tab shell with a gap; list clears Save + tab bar. */
  const stickyBottom = SURFACE_TAB_BAR_CLEARANCE + Math.max(insets.bottom, theme.spacing.md);
  const listBottomPad = stickyBottom + theme.sizes.touch.min + theme.spacing.xl;

  return (
    <AppScreen backFallback={backFallback}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          paddingBottom: listBottomPad,
        }}
        refreshControl={
          <RefreshControl
            refreshing={setupQuery.isRefetching || productQuery.isRefetching}
            onRefresh={() => {
              void setupQuery.refetch();
              void productQuery.refetch();
            }}
          />
        }
      >
        <AppText variant="title">{t('mobile.production.workflow.setupTitle')}</AppText>
        {productLine ? (
          <AppText variant="heading" weight="semibold" dir="ltr" face="latin">
            {productLine}
          </AppText>
        ) : null}
        <AppText variant="caption" color="muted">
          {t('production.setup.newOrdersOnly')}
        </AppText>
        {setupQuery.isPending && !setup ? (
          <ActivityIndicator color={colors.brand} />
        ) : null}
        {setup ? (
          <WorkflowStatusPill
            label={statusLabel(setup.status, t)}
            active={setup.status === 'READY'}
            branded={setup.status !== 'READY'}
          />
        ) : null}
        {(setup?.issues ?? []).length ? (
          <View style={{ ...cardStyle, gap: theme.spacing.sm, borderColor: colors.borderStrong }}>
            <AppText variant="heading" weight="semibold">
              {t('production.setup.issues')}
            </AppText>
            {(setup?.issues ?? []).map((issue, i) => (
              <AppText key={`${issue.code}-${issue.workflowNodeId ?? i}`} variant="caption" color="muted">
                {productionSetupIssueText(issue, stages, locale, t)}
              </AppText>
            ))}
          </View>
        ) : null}

        <View style={{ ...cardStyle, gap: theme.spacing.sm }}>
          <AppText variant="heading" weight="semibold">
            {t('production.setup.bomTitle')}
          </AppText>
          {(setup?.bomLines ?? []).length === 0 ? (
            <AppText variant="caption" color="muted">
              {t('production.setup.bomEmpty')}
            </AppText>
          ) : (
            (setup?.bomLines ?? []).map((line) => {
              const named = productBomBySku.get(line.sku);
              const name = named
                ? localizedName(locale, named, line.sku)
                : line.sku;
              const photoUri = photoBySku.get(line.sku);
              return (
                <View
                  key={line.sku}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    minHeight: 44,
                  }}
                >
                  {photoUri ? (
                    <Image
                      source={{ uri: photoUri }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colors.surfaceSecondary,
                      }}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : null}
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <AppText variant="body" weight="semibold" numberOfLines={1}>
                      {name}
                    </AppText>
                    {name !== line.sku ? (
                      <AppText variant="caption" color="muted" dir="ltr">
                        {line.sku}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText variant="body" weight="semibold" dir="ltr">
                    {String(line.qty)}
                  </AppText>
                </View>
              );
            })
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
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: stickyBottom,
          paddingHorizontal: theme.spacing.lg,
          zIndex: 30,
        }}
      >
        <PrimaryButton
          label={t('mobile.production.workflow.setupSave')}
          loading={saveMutation.isPending}
          disabled={!setup?.workflow || saveMutation.isPending}
          onPress={saveAll}
        />
      </View>

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
