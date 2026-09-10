import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { ReceiveFloorTrigger } from './ReceiveFloorTrigger';

type Props = {
  verified?: boolean;
  busy?: boolean;
  miss?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** Presentation only — the receive screen owns useLabelVerifyScan so the camera can open. */
export function ReceiveLineVerifyChip({ verified, busy, miss, disabled, onPress }: Props) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <ReceiveFloorTrigger
        icon={verified ? 'checkmark-circle-outline' : 'scan-outline'}
        label={
          busy
            ? t('mobile.purchasing.scanToVerify')
            : verified
              ? t('mobile.purchasing.scanVerified')
              : t('mobile.purchasing.scanToVerify')
        }
        success={verified}
        warning={miss && !verified}
        loading={busy}
        disabled={disabled}
        onPress={onPress}
      />
      {miss && !verified ? (
        <AppText color="warning" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.purchasing.scanVerifyMiss')}
        </AppText>
      ) : null}
    </View>
  );
}
