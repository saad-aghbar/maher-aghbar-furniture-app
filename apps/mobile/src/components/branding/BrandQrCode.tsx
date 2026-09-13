import { memo } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

/** Sofa M only — no EST / year. */
const MARK = require('../../../assets/brand/watermark-mark.png');

export const BRAND_QR_ECL = 'H' as const;
export const BRAND_QR_COLOR = '#1A1A1A';
export const BRAND_QR_BACKGROUND = '#FFFFFF';
/** Logo box as a fraction of QR width (finder eyes stay clear). */
export const BRAND_QR_LOGO_RATIO = 0.26;
export const BRAND_QR_LOGO_MARGIN_RATIO = 0.018;

type Props = {
  value: string;
  size: number;
  testID?: string;
};

function BrandQrCodeComponent({ value, size, testID = 'brand-qr-code' }: Props) {
  const logoSize = Math.max(16, Math.round(size * BRAND_QR_LOGO_RATIO));
  const logoMargin = Math.max(2, Math.round(size * BRAND_QR_LOGO_MARGIN_RATIO));
  const logoBorderRadius = Math.max(4, Math.round(size * 0.03));

  return (
    <View testID={testID} accessible={false}>
      <QRCode
        value={value}
        size={size}
        backgroundColor={BRAND_QR_BACKGROUND}
        color={BRAND_QR_COLOR}
        ecl={BRAND_QR_ECL}
        logo={MARK}
        logoSize={logoSize}
        logoMargin={logoMargin}
        logoBackgroundColor={BRAND_QR_BACKGROUND}
        logoBorderRadius={logoBorderRadius}
      />
    </View>
  );
}

export const BrandQrCode = memo(BrandQrCodeComponent);
