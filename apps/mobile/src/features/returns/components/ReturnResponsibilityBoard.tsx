import { useEffect, useState } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { ReturnSheetFooter } from './ReturnSheetFooter';
import { returnCtaStyle } from './returnFloorCta';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { formatQty, parseQty } from '@/components/forms/qtyStepper';
import { QtyStepperField } from '@/components/forms/QtyStepperField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { ReturnChargeStatus, ReturnRequest, ReturnResponsibility } from '../api';

const OPTIONS: ReturnResponsibility[] = [
  'FACTORY_WARRANTY',
  'DEALER_RESPONSIBILITY',
  'SHARED',
  'UNDETERMINED',
];

type Props = {
  row: ReturnRequest;
  dealerFacing?: boolean;
  canEdit?: boolean;
  canCharge?: boolean;
  saving?: boolean;
  sending?: boolean;
  responding?: boolean;
  charging?: boolean;
  onSave: (body: {
    responsibility: ReturnResponsibility;
    dealerAmount?: number;
    factoryAmount?: number;
  }) => void;
  onSend: () => void;
  onRespond: (body: { accept: boolean; note?: string }) => void;
  onCharge: () => void;
};

function moneyLabel(formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string, value: number) {
  return `${formatNumber(value, { maximumFractionDigits: 2 })} ₪`;
}

function positiveMoney(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function amountFieldValue(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? formatQty(n) : '';
}

export function ReturnResponsibilityBoard({
  row,
  dealerFacing,
  canEdit,
  canCharge,
  saving,
  sending,
  responding,
  charging,
  onSave,
  onSend,
  onRespond,
  onCharge,
}: Props) {
  const router = useRouter();
  const { t, locale, isRTL, formatNumber } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [responsibility, setResponsibility] = useState<ReturnResponsibility>(
    (row.responsibility as ReturnResponsibility) || 'UNDETERMINED',
  );
  const [dealerAmount, setDealerAmount] = useState(amountFieldValue(row.chargeAmount));
  const [factoryAmount, setFactoryAmount] = useState(amountFieldValue(row.factoryShareAmount));
  const [sheet, setSheet] = useState<'accept' | 'reject' | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const invoice = row.chargeInvoices?.[0];
  const chargeStatus = (row.chargeStatus as ReturnChargeStatus) || 'NOT_REQUIRED';
  const actual = positiveMoney(row.reworkCost?.actualTotal);
  const estimated = positiveMoney(row.reworkCost?.estimatedTotal);
  const productionCost = actual ?? estimated;
  const parsedDealer = parseQty(dealerAmount) ?? 0;
  const parsedFactory = parseQty(factoryAmount) ?? 0;

  useEffect(() => {
    setResponsibility((row.responsibility as ReturnResponsibility) || 'UNDETERMINED');
    setDealerAmount(amountFieldValue(row.chargeAmount));
    setFactoryAmount(amountFieldValue(row.factoryShareAmount));
  }, [row.responsibility, row.chargeAmount, row.factoryShareAmount]);

  if (
    dealerFacing &&
    chargeStatus === 'NOT_REQUIRED' &&
    !invoice &&
    !row.responsibility
  ) {
    return null;
  }
  const pill = returnCtaStyle(theme);

  const showDealerAmount =
    responsibility === 'DEALER_RESPONSIBILITY' ||
    responsibility === 'SHARED' ||
    responsibility === 'UNDETERMINED';
  const showFactoryAmount = responsibility === 'SHARED';
  const locked = chargeStatus === 'INVOICED';

  const save = () => {
    onSave({
      responsibility,
      dealerAmount:
        showDealerAmount && parsedDealer > 0 ? parsedDealer : undefined,
      factoryAmount:
        showFactoryAmount && parsedFactory > 0 ? parsedFactory : undefined,
    });
  };

  return (
    <DealerBoard
      title={t('mobile.returns.responsibility')}
      titleWeight={titleWeight}
      trailing={
        chargeStatus !== 'NOT_REQUIRED' ? (
          <StatusBadge
            status={chargeStatus}
            label={t(`mobile.returns.chargeStatus.${chargeStatus}`)}
            branded
            dot
          />
        ) : null
      }
    >
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {t('mobile.returns.responsibilityHint')}
      </AppText>

      {!dealerFacing ? (
        <View
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
          }}
        >
          <MoneyLine
            isRTL={isRTL}
            label={
              actual
                ? t('mobile.returns.productionCostActual')
                : estimated
                  ? t('mobile.returns.productionCostEstimated')
                  : t('mobile.returns.productionCostUnknown')
            }
            value={productionCost != null ? moneyLabel(formatNumber, productionCost) : '—'}
            titleWeight={titleWeight}
          />
          {responsibility === 'FACTORY_WARRANTY' ? (
            <MoneyLine
              isRTL={isRTL}
              label={t('mobile.returns.factoryAbsorbs')}
              value={productionCost != null ? moneyLabel(formatNumber, productionCost) : '—'}
              titleWeight={titleWeight}
              valueColor={colors.success}
            />
          ) : null}
        </View>
      ) : null}

      {canEdit ? (
        <View style={{ gap: theme.spacing.sm }}>
          {OPTIONS.map((option) => {
            const selected = responsibility === option;
            return (
              <AnimatedPressable
                key={option}
                variant="button"
                accessibilityLabel={t(`mobile.returns.responsibilityOption.${option}`)}
                disabled={locked}
                onPress={() => {
                  void haptics.selection();
                  setResponsibility(option);
                }}
                style={{
                  minHeight: 44,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: selected ? colors.brand : colors.border,
                  backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
                  justifyContent: 'center',
                  paddingHorizontal: theme.spacing.md,
                }}
              >
                <AppText weight={titleWeight}>
                  {t(`mobile.returns.responsibilityOption.${option}`)}
                </AppText>
              </AnimatedPressable>
            );
          })}
          {showDealerAmount ? (
            <QtyStepperField
              label={
                responsibility === 'UNDETERMINED'
                  ? t('mobile.returns.pendingAgreement')
                  : t('mobile.returns.dealerShare')
              }
              accessibilityLabel={
                responsibility === 'UNDETERMINED'
                  ? t('mobile.returns.pendingAgreement')
                  : t('mobile.returns.dealerShare')
              }
              value={dealerAmount}
              onChangeText={setDealerAmount}
              min={0}
              step={50}
              decimals={2}
              unit="₪"
              disabled={locked}
              placeholder="0"
            />
          ) : null}
          {showFactoryAmount ? (
            <QtyStepperField
              label={t('mobile.returns.factoryShare')}
              accessibilityLabel={t('mobile.returns.factoryShare')}
              value={factoryAmount}
              onChangeText={setFactoryAmount}
              min={0}
              step={50}
              decimals={2}
              unit="₪"
              disabled={locked}
              placeholder="0"
            />
          ) : null}
          {!dealerFacing && productionCost != null && parsedDealer > 0 && responsibility === 'DEALER_RESPONSIBILITY' ? (
            <MoneyLine
              isRTL={isRTL}
              label={t('mobile.returns.chargeVsCost')}
              value={moneyLabel(formatNumber, parsedDealer - productionCost)}
              titleWeight={titleWeight}
            />
          ) : null}
          {!dealerFacing &&
          productionCost != null &&
          parsedDealer > 0 &&
          parsedFactory > 0 &&
          responsibility === 'SHARED' ? (
            <MoneyLine
              isRTL={isRTL}
              label={t('mobile.returns.shareRemainder')}
              value={moneyLabel(formatNumber, parsedDealer + parsedFactory - productionCost)}
              titleWeight={titleWeight}
            />
          ) : null}
          {responsibility === 'UNDETERMINED' && parsedDealer > 0 ? (
            <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('mobile.returns.pendingAgreementHint')}
            </AppText>
          ) : null}
          <SecondaryButton
            label={t('mobile.returns.chargeAmountSave')}
            loading={saving}
            disabled={locked}
            onPress={save}
            style={pill}
          />
        </View>
      ) : row.responsibility ? (
        <AppText weight={titleWeight}>
          {t(`mobile.returns.responsibilityOption.${row.responsibility}`)}
        </AppText>
      ) : null}

      {chargeStatus === 'REJECTED' && row.chargeRejectionNote ? (
        <View
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.warning,
            backgroundColor: colors.warningSoft,
            padding: theme.spacing.md,
          }}
        >
          <AppText variant="caption" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.returns.rejectionNote')}
          </AppText>
          <AppText weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {row.chargeRejectionNote}
          </AppText>
        </View>
      ) : null}

      {Number(row.chargeAmount ?? 0) > 0 ? (
        <MoneyLine
          isRTL={isRTL}
          label={t('mobile.returns.dealerShare')}
          value={moneyLabel(formatNumber, Number(row.chargeAmount))}
          titleWeight={titleWeight}
        />
      ) : null}

      {canEdit && chargeStatus === 'DRAFT' ? (
        <PrimaryButton
          label={t('mobile.returns.sendToDealer')}
          loading={sending}
          onPress={() => {
            void haptics.confirmMedium();
            onSend();
          }}
          style={pill}
        />
      ) : null}

      {dealerFacing && chargeStatus === 'AWAITING_DEALER' ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.returns.dealerAcceptHint')}
          </AppText>
          <PrimaryButton
            label={t('mobile.returns.dealerAccept')}
            loading={responding}
            onPress={() => setSheet('accept')}
            style={pill}
          />
          <SecondaryButton
            label={t('mobile.returns.dealerReject')}
            disabled={responding}
            onPress={() => setSheet('reject')}
            style={pill}
          />
        </View>
      ) : null}

      {canEdit && chargeStatus === 'AWAITING_DEALER' ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.returns.awaitingDealer')}
          </AppText>
          <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.returns.factoryOverrideHint')}
          </AppText>
          <PrimaryButton
            label={t('mobile.returns.recordDealerAccept')}
            loading={responding}
            onPress={() => setSheet('accept')}
            style={pill}
          />
          <SecondaryButton
            label={t('mobile.returns.recordDealerReject')}
            disabled={responding}
            onPress={() => setSheet('reject')}
            style={pill}
          />
        </View>
      ) : null}

      {canCharge && chargeStatus === 'CONFIRMED' && !invoice ? (
        <PrimaryButton
          label={t('mobile.returns.chargeFromCost')}
          loading={charging}
          onPress={onCharge}
          style={pill}
        />
      ) : null}

      {invoice ? (
        <AnimatedPressable
          variant="button"
          accessibilityLabel={invoice.number}
          onPress={() => {
            void haptics.selection();
            router.push(
              (dealerFacing
                ? `/(app)/(customer)/invoices/${invoice.id}`
                : `/(app)/(admin)/invoices/${invoice.id}`) as Href,
            );
          }}
          style={{
            minHeight: 48,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.brand,
            backgroundColor: colors.brandSoft,
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.md,
          }}
        >
          <AppText weight={titleWeight} dir="ltr">
            {t('mobile.returns.chargeInvoice')} · {invoice.number}
          </AppText>
        </AnimatedPressable>
      ) : null}

      <BottomSheet
        open={sheet != null}
        onClose={() => setSheet(null)}
        fitContent
        title={
          sheet === 'reject'
            ? dealerFacing
              ? t('mobile.returns.dealerReject')
              : t('mobile.returns.recordDealerReject')
            : dealerFacing
              ? t('mobile.returns.dealerAccept')
              : t('mobile.returns.recordDealerAccept')
        }
      >
        <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}>
          {Number(row.chargeAmount ?? 0) > 0 ? (
            <AppText weight={titleWeight} dir="ltr">
              {moneyLabel(formatNumber, Number(row.chargeAmount))}
            </AppText>
          ) : null}
          {sheet === 'reject' ? (
            <AppTextInput
              value={rejectNote}
              onChangeText={setRejectNote}
              placeholder={t('mobile.returns.rejectionNotePlaceholder')}
            />
          ) : (
            <AppText color="secondary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {dealerFacing
                ? t('mobile.returns.dealerAcceptHint')
                : t('mobile.returns.factoryOverrideHint')}
            </AppText>
          )}
          <ReturnSheetFooter
            confirmLabel={
              sheet === 'reject'
                ? dealerFacing
                  ? t('mobile.returns.dealerReject')
                  : t('mobile.returns.recordDealerReject')
                : dealerFacing
                  ? t('mobile.returns.dealerAccept')
                  : t('mobile.returns.recordDealerAccept')
            }
            loading={responding}
            destructive={sheet === 'reject'}
            onConfirm={() => {
              void haptics.confirmMedium();
              onRespond({
                accept: sheet === 'accept',
                note: sheet === 'reject' ? rejectNote.trim() : undefined,
              });
              setSheet(null);
              setRejectNote('');
            }}
            onCancel={() => setSheet(null)}
          />
        </View>
      </BottomSheet>
    </DealerBoard>
  );
}

function MoneyLine({
  isRTL,
  label,
  value,
  titleWeight,
  valueColor,
}: {
  isRTL: boolean;
  label: string;
  value: string;
  titleWeight: 'medium' | 'semibold';
  valueColor?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
      <AppText weight={titleWeight} dir="ltr" style={{ color: valueColor ?? colors.textPrimary }}>
        {value}
      </AppText>
    </View>
  );
}
