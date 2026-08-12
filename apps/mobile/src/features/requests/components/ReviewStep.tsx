import { Image, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton, SuccessButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { formatDate, useLocale } from '@/i18n';
import { SuccessBurst } from '@/motion';
import { useTheme } from '@/theme';
import { isImageMime, type PendingAttachment } from '../pendingAttachment';

export type ReviewSummary = {
  modelName: string;
  customerName: string;
  customerPhone: string;
  address: string;
  deliveryNotes: string;
  fabric: string;
  fabricDescription: string;
  dimensionsNotes: string;
  orderNotes: string;
  dealerPo: string;
  quantity: string;
  priority: string;
  unitPrice: number | null;
  currency: string;
  estimatedTotal: number | null;
  /** ISO date (yyyy-mm-dd) the dealer requested, if any. */
  requestedDeliveryDate?: string | null;
  /** ISO date (yyyy-mm-dd) the factory can realistically deliver by. */
  estimatedDeliveryDate?: string | null;
};

type ReviewStepProps = {
  summary: ReviewSummary;
  attachments: PendingAttachment[];
  error?: string | null;
  busy: boolean;
  submittedNumber?: string | null;
  successKey?: string | number;
  /** When false, omit section title (parent provides combined step title). */
  showTitle?: boolean;
  /** When true, primary actions live in the floating dock. */
  hideActions?: boolean;
  onBack: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  onViewOrders: () => void;
  onCreateAnother: () => void;
};

function Row({ label, value }: { label: string; value: string }) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  return (
    <View
      style={{
        paddingVertical: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: theme.spacing.xs,
      }}
    >
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText
        variant="body"
        weight="medium"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {value || '—'}
      </AppText>
    </View>
  );
}

export function ReviewStep({
  summary,
  attachments,
  error,
  busy,
  submittedNumber,
  successKey,
  showTitle = true,
  hideActions = false,
  onBack,
  onSaveDraft,
  onSubmit,
  onViewOrders,
  onCreateAnother,
}: ReviewStepProps) {
  const { t, locale, isRTL, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();

  if (submittedNumber) {
    return (
      <SuccessBurst triggerKey={successKey ?? submittedNumber}>
        <View
          style={{
            gap: theme.spacing.lg,
            alignItems: 'center',
            paddingVertical: theme.spacing.xl,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.successSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="largeTitle" style={{ color: colors.success }}>
              ✓
            </AppText>
          </View>
          <AppText variant="title" weight="semibold" style={{ textAlign: 'center' }}>
            {t('mobile.newOrder.submittedTitle')}
          </AppText>
          <AppText variant="body" color="secondary" style={{ textAlign: 'center' }}>
            {t('mobile.newOrder.submittedBody', { number: submittedNumber })}
          </AppText>
          <PrimaryButton
            label={t('mobile.newOrder.viewOrders')}
            onPress={onViewOrders}
            style={{ alignSelf: 'stretch' }}
          />
          <SecondaryButton
            label={t('mobile.newOrder.createAnother')}
            onPress={onCreateAnother}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </SuccessBurst>
    );
  }

  const images = attachments.filter((a) => isImageMime(a.mimeType));
  const docs = attachments.filter((a) => !isImageMime(a.mimeType));

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {showTitle ? (
        <>
          <AppText variant="title" weight="semibold">
            {t('mobile.newOrder.step4ReviewTitle')}
          </AppText>
          <AppText variant="body" color="secondary">
            {t('mobile.newOrder.step4ReviewBody')}
          </AppText>
        </>
      ) : (
        <AppText variant="label" weight="semibold">
          {t('mobile.newOrder.step4ReviewTitle')}
        </AppText>
      )}

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: theme.radius.lg,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <Row label={t('mobile.newOrder.review.model')} value={summary.modelName} />
        <Row label={t('mobile.newOrder.review.customer')} value={summary.customerName} />
        <Row label={t('mobile.newOrder.review.phone')} value={summary.customerPhone} />
        <Row label={t('mobile.newOrder.review.address')} value={summary.address} />
        <Row label={t('mobile.newOrder.dealerPo')} value={summary.dealerPo} />
        <Row label={t('mobile.newOrder.quantity')} value={summary.quantity} />
        <Row label={t('mobile.newOrder.priority')} value={summary.priority} />
        <Row label={t('mobile.newOrder.fabricName')} value={summary.fabric} />
        <Row
          label={t('mobile.newOrder.fabricDescription')}
          value={summary.fabricDescription}
        />
        <Row label={t('mobile.newOrder.dimensionsNotes')} value={summary.dimensionsNotes} />
        <Row label={t('mobile.newOrder.deliveryNotes')} value={summary.deliveryNotes} />
        {summary.requestedDeliveryDate ? (
          <Row
            label={t('mobile.newOrder.review.requestedDelivery')}
            value={formatDate(locale, summary.requestedDeliveryDate)}
          />
        ) : null}
        {summary.estimatedDeliveryDate ? (
          <Row
            label={t('mobile.newOrder.review.estimatedDelivery')}
            value={formatDate(locale, summary.estimatedDeliveryDate)}
          />
        ) : null}
        <Row label={t('mobile.newOrder.orderNotes')} value={summary.orderNotes} />
        {summary.estimatedTotal != null ? (
          <View style={{ paddingVertical: theme.spacing.md, gap: theme.spacing.xs }}>
            <AppText variant="caption" color="muted">
              {t('mobile.newOrder.review.estimatedTotal')}
            </AppText>
            <AppText variant="title" weight="semibold" color="brand" dir="ltr">
              {formatCurrency(summary.estimatedTotal)}
            </AppText>
            {summary.unitPrice != null ? (
              <AppText variant="caption" color="muted" dir="ltr">
                {t('mobile.newOrder.review.unitPrice')}: {formatCurrency(summary.unitPrice)}
              </AppText>
            ) : null}
          </View>
        ) : (
          <Row label={t('mobile.newOrder.review.estimatedTotal')} value="—" />
        )}
      </View>

      {images.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="label" weight="semibold">
            {t('mobile.newOrder.review.images')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {images.map((img) => (
              <Image
                key={img.id}
                source={{ uri: img.uri }}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: theme.radius.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {docs.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="label" weight="semibold">
            {t('mobile.newOrder.review.attachments')}
          </AppText>
          {docs.map((d) => (
            <AppText key={d.id} variant="caption" color="secondary">
              {d.fileName}
            </AppText>
          ))}
        </View>
      ) : null}

      {error ? (
        <AppText variant="caption" color="error">
          {error}
        </AppText>
      ) : null}

      {!hideActions ? (
        <>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
            <SecondaryButton
              label={t('mobile.newOrder.back')}
              onPress={onBack}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <SecondaryButton
              label={t('mobile.newOrder.saveDraft')}
              onPress={onSaveDraft}
              loading={busy}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </View>
          <SuccessButton
            label={t('mobile.newOrder.submit')}
            onPress={onSubmit}
            loading={busy}
            disabled={busy}
          />
        </>
      ) : null}
    </View>
  );
}
