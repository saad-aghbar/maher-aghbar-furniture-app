import { useEffect, useState } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyCredit,
  previewApplyCredit,
} from '@/api/modules/invoices';
import { queryKeys } from '@/api/queryKeys';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  customerId: string;
  /** Invoice remaining before apply. */
  remaining: number;
  /** Dealer available credit from invoice.dealerFinance or summary. */
  availableCredit: number;
};

/**
 * Explicit apply-credit flow: preview → confirm (no silent auto-apply).
 */
export function ApplyCreditSheet({
  open,
  onClose,
  invoiceId,
  customerId,
  remaining,
  availableCredit,
}: Props) {
  const { t, isRTL, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const qc = useQueryClient();

  const maxApply = Math.max(0, Math.min(remaining, availableCredit));
  const [amount, setAmount] = useState('');
  const sheetHeight = Math.min(Math.round(height * 0.68), 560);

  useEffect(() => {
    if (!open) return;
    setAmount(maxApply > 0 ? String(Number(maxApply.toFixed(3))) : '');
  }, [open, maxApply]);

  const want = Number(amount);
  const previewQuery = useQuery({
    queryKey: ['apply-credit-preview', invoiceId, amount],
    queryFn: () =>
      previewApplyCredit(
        invoiceId,
        Number.isFinite(want) && want > 0 ? want : undefined,
      ),
    enabled: open && maxApply > 0,
  });

  const preview = previewQuery.data;
  const applyAmount = preview?.applyAmount ?? 0;

  const applyMutation = useMutation({
    mutationFn: applyCredit,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.invoices.detail(invoiceId) });
      await qc.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
      await qc.invalidateQueries({ queryKey: queryKeys.payments.lists() });
      await qc.invalidateQueries({ queryKey: queryKeys.payments.dealerSummary(customerId) });
      await qc.invalidateQueries({ queryKey: queryKeys.statements.detail(customerId) });
    },
  });

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('accounting.applyCredit')}
      sheetHeight={sheetHeight}
    >
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('accounting.applyCreditHint')}
        </AppText>

        <View
          style={{
            gap: theme.spacing.sm,
            padding: theme.spacing.md,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <MetaRow
            label={t('accounting.amountDue')}
            value={formatCurrency(remaining)}
          />
          <MetaRow
            label={t('accounting.accountCredit')}
            value={formatCurrency(availableCredit)}
          />
        </View>

        <TextField
          label={t('accounting.applyCreditAmount')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        {previewQuery.isFetching ? (
          <ActivityIndicator color={colors.brand} />
        ) : preview ? (
          <View
            style={{
              gap: theme.spacing.sm,
              padding: theme.spacing.md,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              color="brand"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('accounting.applyCreditPreview')}
            </AppText>
            <MetaRow
              label={t('accounting.applyCreditWillApply')}
              value={formatCurrency(preview.applyAmount)}
              emphasize
            />
            <MetaRow
              label={t('accounting.invoiceRemainingAfter')}
              value={formatCurrency(preview.invoiceRemainingAfter)}
            />
            <MetaRow
              label={t('accounting.creditRemainingAfter')}
              value={formatCurrency(preview.creditRemainingAfter)}
            />
          </View>
        ) : null}

        <PrimaryButton
          label={t('accounting.confirmApplyCredit')}
          loading={applyMutation.isPending}
          disabled={!(applyAmount > 0)}
          style={{ borderRadius: theme.radius.xl }}
          onPress={() => {
            if (!(applyAmount > 0)) {
              void haptics.error();
              return;
            }
            applyMutation.mutate(
              {
                invoiceId,
                amount: applyAmount,
                idempotencyKey: `credit-${invoiceId}-${Date.now()}`,
              },
              {
                onSuccess: () => {
                  void haptics.confirmMedium();
                  onClose();
                  showToast({
                    variant: 'success',
                    message: t('accounting.creditApplied'),
                  });
                },
                onError: () => {
                  void haptics.error();
                  showToast({
                    variant: 'error',
                    message: t('accounting.creditApplyFailed'),
                  });
                },
              },
            );
          }}
        />
        <SecondaryButton
          label={t('common.cancel')}
          onPress={onClose}
          style={{ borderRadius: theme.radius.xl }}
        />
      </View>
    </BottomSheet>
  );
}

function MetaRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 8,
      }}
    >
      <AppText
        variant="caption"
        color={emphasize ? 'brand' : 'secondary'}
        style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
      <AppText
        weight="semibold"
        dir="ltr"
        style={{
          color: emphasize ? colors.brand : colors.textPrimary,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
