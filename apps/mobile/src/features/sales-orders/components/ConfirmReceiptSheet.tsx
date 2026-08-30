import { Image, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
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
  orderNumber,
  productTitle,
  quantity,
  imageUrl,
  loading,
  error,
  canConfirm = true,
  onClose,
  onConfirm,
}: Props) {
  const { t, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const uri = resolveOrderMediaUri(imageUrl);

  return (
    <BottomSheet
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={t('lifecycle.confirmReceiptTitle')}
    >
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
        <AppText variant="body" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('lifecycle.confirmReceiptBody')}
        </AppText>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: theme.spacing.md,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: theme.radius.md,
              overflow: 'hidden',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {uri ? (
              <Image
                source={{ uri }}
                style={{ width: 64, height: 64 }}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <AppText variant="caption" color="muted">
                —
              </AppText>
            )}
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
              dir="ltr"
            >
              {orderNumber}
            </AppText>
            <AppText
              variant="body"
              weight="semibold"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {productTitle}
            </AppText>
            {quantity != null ? (
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                ×{quantity}
              </AppText>
            ) : null}
          </View>
        </View>
        {error ? (
          <View
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.error,
              padding: theme.spacing.md,
            }}
          >
            <AppText
              variant="caption"
              style={{ color: colors.error, textAlign: isRTL ? 'right' : 'left' }}
            >
              {error}
            </AppText>
          </View>
        ) : null}
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              label={t('lifecycle.confirmReceiptCancel')}
              onPress={onClose}
              disabled={loading}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label={t('lifecycle.confirmReceived')}
              onPress={onConfirm}
              loading={loading}
              disabled={!canConfirm || Boolean(loading)}
              accessibilityLabel={`${t('lifecycle.confirmReceived')} ${orderNumber}`}
            />
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
