import { Image, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerFormError, DealerFormFooter } from '@/features/dealers/components/dealerSheetForm';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { resolveOrderMediaUri } from './OrderCardMedia';

type Props = {
  open: boolean;
  orderNumber: string;
  productTitle: string;
  quantity?: string | number | null;
  imageUrl?: string | null;
  loading?: boolean;
  error?: string | null;
  canConfirm?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmReceiptSheet({
  open,
  onClose,
  orderNumber,
  productTitle,
  quantity,
  imageUrl,
  loading,
  error,
  canConfirm = true,
  onConfirm,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme, colors } = useTheme();
  const uri = resolveOrderMediaUri(imageUrl);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <BottomSheet
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={t('lifecycle.confirmReceiptTitle')}
      fitContent
      maxHeight={560}
    >
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        <AppText variant="body" color="secondary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('lifecycle.confirmReceiptBody')}
        </AppText>
        <DealerBoard title={orderNumber} titleWeight={titleWeight}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.md,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: theme.radius.md,
                overflow: 'hidden',
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {uri ? (
                <Image
                  source={{ uri }}
                  style={{ width: 72, height: 72 }}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <AppText variant="caption" color="muted">
                  —
                </AppText>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <AppText
                weight={titleWeight}
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {productTitle}
              </AppText>
              {quantity != null ? (
                <AppText
                  variant="caption"
                  color="muted"
                  dir="ltr"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.orders.qty')} · {String(quantity)}
                </AppText>
              ) : null}
            </View>
          </View>
        </DealerBoard>
        {error ? <DealerFormError message={error} /> : null}
        <DealerFormFooter
          confirmLabel={t('lifecycle.confirmReceived')}
          onConfirm={() => {
            void haptics.confirmMedium();
            onConfirm();
          }}
          onCancel={onClose}
          loading={loading}
          disabled={loading || !canConfirm}
        />
      </View>
    </BottomSheet>
  );
}
