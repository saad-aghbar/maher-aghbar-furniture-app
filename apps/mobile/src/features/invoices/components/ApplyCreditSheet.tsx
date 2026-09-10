import { useEffect, useMemo, useRef, useState } from 'react';
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
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { applyCreditLocalPreview, shouldSeedInvoiceSheet } from '../invoiceSheetSeed';

type Props = {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  customerId: string;
  /** Invoice remaining before apply. */
  remaining: number;
  /** Dealer available credit from invoice.dealerFinance or summary. */
  availableCredit: number;
  onApplied?: () => void;
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
  onApplied,
}: Props) {
  const { t, isRTL, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { height } = useWindowDimensions();
  const qc = useQueryClient();

  const maxApply = Math.max(0, Math.min(remaining, availableCredit));
  const [amount, setAmount] = useState('');
  const wasOpen = useRef(false);
  const sheetHeight = Math.min(Math.round(height * 0.68), 560);

  useEffect(() => {
    if (shouldSeedInvoiceSheet(open, wasOpen.current)) {
      setAmount(maxApply > 0 ? String(Number(maxApply.toFixed(3))) : '');
    }
    wasOpen.current = open;
  }, [open, maxApply]);

  const want = Number(amount);
  const local = useMemo(
    () => applyCreditLocalPreview(want, remaining, availableCredit),
    [want, remaining, availableCredit],
  );
  const previewQuery = useQuery({
    queryKey: ['apply-credit-preview', invoiceId, amount],
    queryFn: () =>
      previewApplyCredit(
        invoiceId,
        Number.isFinite(want) && want > 0 ? want : undefined,
      ),
    enabled: open && maxApply > 0,
  });
  const applyAmount = local.applyAmount;

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

        <QtyStepperField
          label={t('accounting.applyCreditAmount')}
          value={amount}
          onChangeText={setAmount}
          unit="₪"
          step={1}
          decimals={2}
          min={0}
          max={maxApply}
        />

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
          {previewQuery.isFetching ? <ActivityIndicator color={colors.brand} /> : null}
          <MetaRow
            label={t('accounting.applyCreditWillApply')}
            value={formatCurrency(local.applyAmount)}
            emphasize
          />
          <MetaRow
            label={t('accounting.invoiceRemainingAfter')}
            value={formatCurrency(local.invoiceRemainingAfter)}
          />
          <MetaRow
            label={t('accounting.creditRemainingAfter')}
            value={formatCurrency(local.creditRemainingAfter)}
          />
        </View>

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
                  onApplied?.();
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
