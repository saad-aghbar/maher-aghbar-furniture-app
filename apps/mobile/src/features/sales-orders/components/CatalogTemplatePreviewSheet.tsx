import { ActivityIndicator, ScrollView, View } from 'react-native';
import { localizedName } from '@maher/i18n';
import type { CatalogSeedPreview } from '@/api/modules/sales-orders';
import { translateApiError } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { productionInsetStyle } from '@/features/production/productionFloorStyle';
import {
  catalogPreviewSheetPhase,
  isCatalogPreviewNetworkError,
} from '@/features/sales-orders/catalogTemplateSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  open: boolean;
  onClose: () => void;
  preview: CatalogSeedPreview | undefined;
  loading?: boolean;
  applying?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onApply: () => void;
};

function workflowLabel(
  locale: string,
  workflow: CatalogSeedPreview['productPlan']['workflow'],
  fallback: string,
): string {
  if (!workflow) return fallback;
  const name =
    localizedName(
      locale,
      {
        nameEn: workflow.nameEn,
        nameAr: workflow.nameAr,
        nameHe: workflow.nameHe,
      },
      workflow.code ?? '',
    ) || workflow.code || fallback;
  if (workflow.versionNumber != null) return `${name} v${workflow.versionNumber}`;
  return name;
}

function FactRow({
  label,
  value,
  titleWeight,
}: {
  label: string;
  value: string;
  titleWeight: 'medium' | 'semibold';
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
      }}
    >
      <AppText variant="caption" color="muted" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight={titleWeight}
        style={{ color: colors.textPrimary, textAlign: isRTL ? 'left' : 'right' }}
      >
        {value}
      </AppText>
    </View>
  );
}

/**
 * Impact preview for Use product production plan. GET-only until Apply.
 * Every branch is terminal: loading, error+retry, or content. Close is always available.
 */
export function CatalogTemplatePreviewSheet({
  open,
  onClose,
  preview,
  loading,
  applying,
  error,
  onRetry,
  onApply,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const phase = catalogPreviewSheetPhase({
    open,
    loading: Boolean(loading),
    hasPreview: Boolean(preview),
    error,
    applying: Boolean(applying),
  });
  const productName = preview?.product
    ? localizedName(
        locale,
        {
          nameEn: preview.product.nameEn,
          nameAr: preview.product.nameAr,
          nameHe: preview.product.nameHe,
        },
        preview.product.sku ?? '',
      ) || preview.product.nameEn || '—'
    : '—';
  const willNotChangeKeys = preview?.willNotChange ?? [];
  const currentWorkflow = workflowLabel(
    locale,
    preview?.current.workflow ?? null,
    t('mobile.productionSetup.catalogTemplate.customWorkflow'),
  );
  const productWorkflow = workflowLabel(
    locale,
    preview?.productPlan.workflow ?? null,
    '—',
  );
  const errorMessage = isCatalogPreviewNetworkError(error)
    ? t('mobile.productionSetup.catalogTemplate.previewFailed')
    : translateApiError(locale, error);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.productionSetup.catalogTemplate.previewTitle')}
      fitContent
      maxHeight={640}
    >
      {phase === 'loading' ? (
        <View style={{ paddingVertical: theme.spacing.xl, gap: theme.spacing.md }}>
          <ActivityIndicator color={colors.brand} testID="catalog-preview-spinner" />
          <SecondaryButton label={t('common.cancel')} onPress={onClose} />
        </View>
      ) : phase === 'error' ? (
        <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
          <AppText variant="body" align="center">
            {errorMessage}
          </AppText>
          {onRetry ? (
            <PrimaryButton
              label={t('common.retry')}
              onPress={onRetry}
            />
          ) : null}
          <SecondaryButton label={t('common.cancel')} onPress={onClose} />
        </View>
      ) : (
        <ScrollView
          style={{ maxHeight: 480 }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
        >
          <AppText variant="heading" weight={titleWeight} align="center">
            {productName}
          </AppText>
          <AppText variant="caption" color="muted" align="center">
            {t('mobile.productionSetup.catalogTemplate.lineScope')}
          </AppText>

          {preview?.current.hasExistingPlan ? (
            <DealerBoard
              title={t('mobile.productionSetup.catalogTemplate.currentPlan')}
              titleWeight={titleWeight}
            >
              <View style={productionInsetStyle(theme, colors)}>
                <FactRow
                  label={t('mobile.productionSetup.catalogTemplate.materials')}
                  value={String(preview.current.materials)}
                  titleWeight={titleWeight}
                />
                <FactRow
                  label={t('mobile.productionSetup.catalogTemplate.workflow')}
                  value={currentWorkflow}
                  titleWeight={titleWeight}
                />
                <FactRow
                  label={t('mobile.productionSetup.catalogTemplate.tasks')}
                  value={String(preview.current.tasks)}
                  titleWeight={titleWeight}
                />
              </View>
            </DealerBoard>
          ) : null}

          <DealerBoard
            title={t('mobile.productionSetup.catalogTemplate.productPlan')}
            titleWeight={titleWeight}
          >
            <AppText variant="caption" color="muted">
              {t('mobile.productionSetup.catalogTemplate.willLoad')}
            </AppText>
            <View style={productionInsetStyle(theme, colors)}>
              <FactRow
                label={t('mobile.productionSetup.catalogTemplate.materials')}
                value={t('mobile.productionSetup.catalogTemplate.requirementsCount', {
                  n: preview?.productPlan.materials ?? 0,
                })}
                titleWeight={titleWeight}
              />
              <FactRow
                label={t('mobile.productionSetup.catalogTemplate.workflow')}
                value={t('mobile.productionSetup.catalogTemplate.stagesCount', {
                  n: preview?.productPlan.stages ?? 0,
                })}
                titleWeight={titleWeight}
              />
              <FactRow
                label={t('mobile.productionSetup.catalogTemplate.tasks')}
                value={t('mobile.productionSetup.catalogTemplate.tasksCount', {
                  n: preview?.productPlan.tasks ?? 0,
                })}
                titleWeight={titleWeight}
              />
              <FactRow
                label={t('mobile.productionSetup.catalogTemplate.semiWip')}
                value={t('mobile.productionSetup.catalogTemplate.semiCount', {
                  n: preview?.productPlan.semiWip ?? 0,
                })}
                titleWeight={titleWeight}
              />
              <FactRow
                label={t('mobile.productionSetup.catalogTemplate.durations')}
                value={t('mobile.productionSetup.catalogTemplate.durationsFromProduct')}
                titleWeight={titleWeight}
              />
            </View>
            {preview?.productPlan.workflow ? (
              <AppText variant="caption" color="secondary">
                {productWorkflow}
              </AppText>
            ) : null}
          </DealerBoard>

          {preview?.workflowWouldChange ? (
            <DealerBoard
              title={t('mobile.productionSetup.catalogTemplate.changeWorkflowTitle')}
              titleWeight={titleWeight}
              accentColor={colors.warning}
            >
              <AppText variant="caption" color="secondary">
                {t('mobile.productionSetup.catalogTemplate.assignmentsMayBeAffected')}
              </AppText>
            </DealerBoard>
          ) : null}

          <DealerBoard
            title={t('mobile.productionSetup.catalogTemplate.willNotChange')}
            titleWeight={titleWeight}
          >
            <View style={productionInsetStyle(theme, colors)}>
              {willNotChangeKeys.map((key) => (
                <AppText
                  key={key}
                  variant="caption"
                  style={{
                    textAlign: isRTL ? 'right' : 'left',
                    color: colors.textSecondary,
                  }}
                >
                  {t(`mobile.productionSetup.catalogTemplate.${key}`)}
                </AppText>
              ))}
            </View>
          </DealerBoard>

          <View style={{ gap: theme.spacing.sm }}>
            <PrimaryButton
              label={t('mobile.productionSetup.catalogTemplate.applyPlan')}
              onPress={onApply}
              loading={phase === 'applying'}
              disabled={phase === 'applying'}
            />
            <SecondaryButton
              label={t('common.cancel')}
              onPress={onClose}
            />
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  );
}
