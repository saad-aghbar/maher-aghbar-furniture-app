import { Image, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { InvoiceDetailModel } from '../selectInvoice';
import { qrImageSrc } from '../jofotaraQr';
import { InvoiceFloorBoard } from './InvoiceFloorBoard';

type Props = {
  model: InvoiceDetailModel;
};

/** Quieter JoFotara clearance board with optional QR tile. */
export function InvoiceJofotaraBoard({ model }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const qrSrc = model.jofotara.qr ? qrImageSrc(model.jofotara.qr) : null;
  const statusLabel = model.jofotara.status ?? (model.jofotara.submitted ? '—' : null);

  return (
    <InvoiceFloorBoard title={t('accounting.jofotara')} quiet>
      {model.jofotara.submitted ? (
        <View style={{ gap: theme.spacing.md }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            {statusLabel ? (
              <View
                style={{
                  paddingHorizontal: theme.spacing.sm + 2,
                  paddingVertical: 5,
                  borderRadius: theme.radius.full,
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.brand,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  dir="ltr"
                  style={{ color: colors.brand, fontSize: 11 }}
                >
                  {statusLabel}
                </AppText>
              </View>
            ) : null}
            {model.jofotara.clearedAtLabel ? (
              <AppText
                variant="caption"
                color="secondary"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {`${t('accounting.jofotaraClearedAt')} · ${model.jofotara.clearedAtLabel}`}
              </AppText>
            ) : null}
          </View>

          {model.jofotara.uuid ? (
            <View style={{ gap: 2 }}>
              <AppText
                variant="caption"
                color="muted"
                style={{ fontSize: 10, textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('accounting.jofotaraUuid')}
              </AppText>
              <AppText
                variant="caption"
                dir="ltr"
                numberOfLines={2}
                style={{
                  fontSize: 12,
                  lineHeight: 16,
                  textAlign: isRTL ? 'right' : 'left',
                  color: colors.textSecondary,
                }}
              >
                {model.jofotara.uuid}
              </AppText>
            </View>
          ) : null}

          {qrSrc ? (
            <View
              style={{
                alignSelf: isRTL ? 'flex-end' : 'flex-start',
                padding: theme.spacing.md,
                borderRadius: theme.radius.lg,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: colors.borderStrong,
              }}
            >
              <Image
                source={{ uri: qrSrc }}
                style={{ width: 120, height: 120 }}
                resizeMode="contain"
                accessibilityLabel={t('accounting.jofotaraQr')}
              />
            </View>
          ) : model.jofotara.qr ? (
            <AppText
              variant="caption"
              dir="ltr"
              style={{
                padding: theme.spacing.sm,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                fontFamily: 'Courier',
                fontSize: 11,
              }}
            >
              {model.jofotara.qr}
            </AppText>
          ) : null}
        </View>
      ) : (
        <View
          style={{
            gap: 6,
            padding: theme.spacing.md,
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AppText
            weight={titleWeight}
            style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 14 }}
          >
            {t('accounting.jofotaraNotCleared')}
          </AppText>
          <AppText
            variant="caption"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 18 }}
          >
            {t('accounting.jofotaraNotClearedHint')}
          </AppText>
        </View>
      )}
    </InvoiceFloorBoard>
  );
}
