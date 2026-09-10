import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { QuotationValidityStub } from './QuotationValidityStub';

export type QuotationDecisionKind = 'accept' | 'reject' | 'revision';

type Props = {
  open: boolean;
  kind: QuotationDecisionKind | null;
  onClose: () => void;
  number: string;
  totalLabel: string;
  expirationDate?: string | null;
  commerciallyExpired?: boolean;
  busy?: boolean;
  onConfirm: (reason?: string) => void;
};

/**
 * Accept / reject / revision sheet — folio board + optional reason, not a flat confirm.
 */
export function QuotationDecisionSheet({
  open,
  kind,
  onClose,
  number,
  totalLabel,
  expirationDate,
  commerciallyExpired,
  busy,
  onConfirm,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  const title =
    kind === 'reject'
      ? t('mobile.dealerQuotations.rejectTitle')
      : kind === 'revision'
        ? t('mobile.dealerQuotations.revisionTitle')
        : t('mobile.dealerQuotations.acceptTitle');
  const message =
    kind === 'reject'
      ? t('mobile.dealerQuotations.rejectBody')
      : kind === 'revision'
        ? t('mobile.dealerQuotations.revisionBody')
        : t('mobile.dealerQuotations.acceptBody', { number, total: totalLabel });
  const confirmLabel =
    kind === 'reject'
      ? t('mobile.dealerQuotations.rejectCta')
      : kind === 'revision'
        ? t('mobile.dealerQuotations.revisionCta')
        : t('mobile.dealerQuotations.acceptCta');
  const withReason = kind === 'reject' || kind === 'revision';
  const reasonLabel =
    kind === 'reject'
      ? t('mobile.dealerQuotations.rejectReasonOptional')
      : t('quotations.revisionComment');
  const reasonPlaceholder =
    kind === 'reject' ? t('mobile.dealerQuotations.rejectReasonPlaceholder') : undefined;
  const accent =
    kind === 'reject' ? colors.error : kind === 'revision' ? colors.warning : colors.success;
  const pill = {
    borderRadius: theme.radius.full,
    minHeight: theme.sizes.touch.min,
    paddingVertical: 0,
  } as const;

  const handleConfirm = () => {
    onConfirm(withReason ? reason.trim() || undefined : undefined);
  };

  return (
    <BottomSheet
      open={open && kind != null}
      onClose={onClose}
      title={title}
      fitContent
      maxHeight={withReason ? 560 : 420}
    >
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        <DealerBoard
          title={t('mobile.dealerQuotations.folioEyebrow')}
          titleWeight={titleWeight}
          accentColor={accent}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'stretch',
              gap: theme.spacing.md,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 6, justifyContent: 'center' }}>
              <AppText
                weight={titleWeight}
                dir="ltr"
                numberOfLines={1}
                style={{ fontSize: 18, textAlign: isRTL ? 'right' : 'left' }}
              >
                {number}
              </AppText>
              <AppText
                variant="caption"
                color="muted"
                style={{
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  letterSpacing: locale === 'ar' ? 0 : 0.45,
                  fontSize: 10,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {t('mobile.dealerQuotations.offer')}
              </AppText>
              <AppText
                weight={titleWeight}
                dir="ltr"
                style={{
                  fontSize: 20,
                  lineHeight: locale === 'ar' ? 30 : 24,
                  textAlign: isRTL ? 'right' : 'left',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {totalLabel}
              </AppText>
            </View>
            <QuotationValidityStub
              expirationDate={expirationDate}
              commerciallyExpired={commerciallyExpired}
            />
          </View>
        </DealerBoard>

        <AppText
          variant="body"
          color="secondary"
          style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 22 }}
        >
          {message}
        </AppText>

        {withReason ? (
          <DealerBoard title={reasonLabel} titleWeight={titleWeight} hideAccent>
            <TextField
              value={reason}
              onChangeText={setReason}
              placeholder={reasonPlaceholder}
              multiline
              growMinHeight={72}
            />
          </DealerBoard>
        ) : null}

        <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}>
          {kind === 'reject' ? (
            <DestructiveButton
              label={confirmLabel}
              style={pill}
              disabled={busy}
              onPress={handleConfirm}
            />
          ) : (
            <PrimaryButton
              label={confirmLabel}
              style={pill}
              disabled={busy}
              onPress={handleConfirm}
            />
          )}
          <SecondaryButton
            label={t('mobile.adminQuotation.cancel')}
            style={pill}
            onPress={onClose}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
