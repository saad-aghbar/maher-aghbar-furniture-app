import { ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { OrderProductionSetupReleasePreview } from '../../api';

type Props = {
  open: boolean;
  onClose: () => void;
  preview: OrderProductionSetupReleasePreview | undefined;
  loadingPreview: boolean;
  releasing: boolean;
  onRelease: () => void;
};

function packagingSummary(
  packaging: OrderProductionSetupReleasePreview['lines'][number]['packagingExpectation'],
): string | null {
  if (!packaging || typeof packaging !== 'object') return null;
  const count =
    typeof packaging.expectedPieceCount === 'number'
      ? packaging.expectedPieceCount
      : Array.isArray(packaging.pieceLabels)
        ? packaging.pieceLabels.length
        : null;
  if (count == null || count <= 0) return null;
  return String(count);
}

export function ReleaseReviewSheet({
  open,
  onClose,
  preview,
  loadingPreview,
  releasing,
  onRelease,
}: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const canRelease = Boolean(preview?.canRelease);
  const issues = preview?.validation.issues ?? [];
  const lines = preview?.lines ?? [];

  const shortageRows = lines.flatMap((line) =>
    (line.materials ?? [])
      .filter((m) => {
        const av = m.availability as { status?: string; short?: number } | null | undefined;
        return (
          String(av?.status ?? '').toUpperCase() === 'SHORTAGE' ||
          (typeof av?.short === 'number' && av.short > 0)
        );
      })
      .map((m) => ({
        lineName: line.manufacturingName ?? '—',
        sku: m.sku,
        displayName: m.displayName,
        short: (m.availability as { short?: number } | null)?.short,
      })),
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.productionSetup.releaseTitle')}
      fitContent
      maxHeight={560}
    >
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="caption" color="secondary">
          {t('mobile.productionSetup.releaseBody')}
        </AppText>

        {loadingPreview ? (
          <AppText variant="caption" color="muted">
            {t('mobile.productionSetup.loadingPreview')}
          </AppText>
        ) : (
          <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: theme.spacing.sm }}>
            <AppText variant="label" weight="semibold">
              {t('mobile.productionSetup.releaseSummary.products')}
            </AppText>
            {lines.map((line) => {
              const pieces = packagingSummary(line.packagingExpectation);
              const materialCount = line.materials?.length ?? 0;
              return (
                <View
                  key={line.salesOrderLineId}
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    padding: theme.spacing.sm,
                    gap: 2,
                  }}
                >
                  <AppText variant="label" weight="semibold" numberOfLines={2}>
                    {line.manufacturingName ?? '—'}
                  </AppText>
                  <AppText variant="caption" color="secondary" dir="ltr">
                    {t('mobile.orderDetail.qty')}: {line.quantity}
                    {line.workflow
                      ? ` · ${line.workflow.code}`
                      : ` · ${t('mobile.productionSetup.noWorkflowSelected')}`}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {t(
                      `mobile.productionSetup.materialStatus.${String(line.materialStatus).toUpperCase()}`,
                    )}
                    {materialCount > 0
                      ? ` · ${t('mobile.productionSetup.releaseSummary.materialCount', {
                          n: materialCount,
                        })}`
                      : ''}
                    {pieces
                      ? ` · ${t('mobile.productionSetup.releaseSummary.pieces', {
                          n: pieces,
                        })}`
                      : ''}
                  </AppText>
                </View>
              );
            })}

            {shortageRows.length > 0 ? (
              <View style={{ gap: 4 }}>
                <AppText variant="label" weight="semibold" style={{ color: colors.warning }}>
                  {t('mobile.productionSetup.releaseSummary.shortages')}
                </AppText>
                {shortageRows.slice(0, 8).map((row, idx) => (
                  <AppText
                    key={`${row.sku ?? row.displayName}-${idx}`}
                    variant="caption"
                    color="secondary"
                  >
                    • {row.displayName || row.sku || '—'}
                    {row.sku ? ` (${row.sku})` : ''}
                    {row.short != null && row.short > 0 ? ` · −${row.short}` : ''}
                  </AppText>
                ))}
                <AppText variant="caption" color="muted">
                  {t('mobile.productionSetup.readiness.shortageNote')}
                </AppText>
              </View>
            ) : preview?.materialReadiness.anyShortage ? (
              <AppText variant="caption" color="secondary">
                {t('mobile.productionSetup.readiness.shortageNote')}
              </AppText>
            ) : null}

            {issues.length > 0 ? (
              <View style={{ gap: 4 }}>
                <AppText variant="label" weight="semibold" style={{ color: colors.warning }}>
                  {t('mobile.productionSetup.blockingIssues')}
                </AppText>
                {issues.slice(0, 6).map((issue, idx) => (
                  <AppText key={`${issue.code}-${idx}`} variant="caption" color="secondary">
                    • {issue.message}
                  </AppText>
                ))}
              </View>
            ) : null}

            <AppText variant="caption" color="muted">
              {t('mobile.productionSetup.releaseSummary.workerNext')}
            </AppText>
          </ScrollView>
        )}

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <SecondaryButton label={t('mobile.orderDetail.cancel')} onPress={onClose} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <PrimaryButton
              label={t('mobile.productionSetup.releaseConfirm')}
              onPress={onRelease}
              loading={releasing}
              disabled={!canRelease || loadingPreview}
            />
            {!loadingPreview && !canRelease ? (
              <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                {issues.length > 0
                  ? t('mobile.productionSetup.releaseDisabledReason', {
                      count: issues.length,
                    })
                  : t('mobile.productionSetup.releaseDisabledGeneric')}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
