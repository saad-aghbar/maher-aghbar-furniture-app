import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  confirmCommercialPrices,
  type CommercialSummary,
  type CommercialGrossDifference,
} from '@/api/modules/sales-orders';
import { queryKeys } from '@/api/queryKeys';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { OrderBoardCard } from '@/features/sales-orders/components/OrderBoardCard';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  orderId: string;
  summary: CommercialSummary;
  grossDifference?: CommercialGrossDifference | null;
};

/**
 * Admin commercial price gate — REQUIRED lines need confirm before invoicing.
 */
export function CommercialSummaryPanel({
  orderId,
  summary,
  grossDifference,
}: Props) {
  const { t, isRTL, formatCurrency, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const requiredLines = useMemo(
    () =>
      summary.lines.filter(
        (l) => String(l.commercialPriceStatus).toUpperCase() === 'REQUIRED',
      ),
    [summary.lines],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const openSheet = () => {
    const next: Record<string, string> = {};
    for (const line of requiredLines) {
      next[line.id] =
        line.unitPrice > 0 ? String(Number(line.unitPrice.toFixed(3))) : '';
    }
    setPrices(next);
    setSheetOpen(true);
  };

  const confirmMutation = useMutation({
    mutationFn: (lines: Array<{ lineId: string; unitPrice: number; note?: string }>) =>
      confirmCommercialPrices(orderId, lines),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.salesOrders.detail(orderId) });
    },
  });

  return (
    <>
      <OrderBoardCard>
        <View style={{ gap: theme.spacing.md }}>
          <AppText
            variant="label"
            weight={titleWeight}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('accounting.commercialSummary')}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {summary.commercialComplete
              ? t('accounting.commercialComplete')
              : t('accounting.commercialIncomplete')}
          </AppText>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            <AppText variant="caption" color="secondary">
              {t('accounting.orderTotal')}
            </AppText>
            <AppText weight="semibold" dir="ltr">
              {formatCurrency(summary.orderTotal)}
            </AppText>
          </View>

          {grossDifference?.available && grossDifference.grossDifference != null ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
              }}
            >
              <AppText variant="caption" color="secondary">
                {t('accounting.grossDifference')}
              </AppText>
              <AppText weight="semibold" dir="ltr" color="brand">
                {formatCurrency(grossDifference.grossDifference)}
              </AppText>
            </View>
          ) : null}

          {requiredLines.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('accounting.requiredPriceLines', {
                  count: requiredLines.length,
                })}
              </AppText>
              {requiredLines.map((line) => (
                <View
                  key={line.id}
                  style={{
                    padding: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    gap: 4,
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    numberOfLines={2}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {line.description}
                  </AppText>
                  <AppText variant="caption" color="muted" dir="ltr">
                    {t('accounting.phaseRequired')}
                  </AppText>
                </View>
              ))}
              <PrimaryButton
                label={t('accounting.confirmCommercialPrices')}
                onPress={() => {
                  void haptics.selection();
                  openSheet();
                }}
                style={{ borderRadius: theme.radius.xl }}
              />
            </View>
          ) : null}
        </View>
      </OrderBoardCard>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('accounting.confirmCommercialPrices')}
        sheetHeight={520}
      >
        <View style={{ gap: theme.spacing.md, flex: 1 }}>
          {requiredLines.map((line) => (
            <TextField
              key={line.id}
              label={line.description}
              value={prices[line.id] ?? ''}
              onChangeText={(v) =>
                setPrices((prev) => ({ ...prev, [line.id]: v }))
              }
              keyboardType="decimal-pad"
            />
          ))}
          <PrimaryButton
            label={t('accounting.confirmPrices')}
            loading={confirmMutation.isPending}
            style={{ borderRadius: theme.radius.xl }}
            onPress={() => {
              const lines = requiredLines.map((line) => ({
                lineId: line.id,
                unitPrice: Number(prices[line.id]),
              }));
              if (lines.some((l) => !(l.unitPrice > 0))) {
                void haptics.error();
                showToast({
                  variant: 'error',
                  message: t('accounting.commercialPriceInvalid'),
                });
                return;
              }
              confirmMutation.mutate(lines, {
                onSuccess: () => {
                  void haptics.confirmMedium();
                  setSheetOpen(false);
                  showToast({
                    variant: 'success',
                    message: t('accounting.commercialPricesConfirmed'),
                  });
                },
                onError: () => {
                  void haptics.error();
                  showToast({
                    variant: 'error',
                    message: t('accounting.commercialPricesFailed'),
                  });
                },
              });
            }}
          />
          <SecondaryButton
            label={t('common.cancel')}
            onPress={() => setSheetOpen(false)}
            style={{ borderRadius: theme.radius.xl }}
          />
        </View>
      </BottomSheet>
    </>
  );
}
