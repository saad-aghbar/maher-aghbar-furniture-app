import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import {
  ORDER_STATION_CAPTION_KEY,
  type OrderStationStubKind,
} from '../selectDealerOrders';

type Props = {
  kind: OrderStationStubKind;
  progressLabel: string;
};

/**
 * Commercial ticket stub — station caption + progress %, not a calendar day.
 */
export function OrderStationStub({ kind, progressLabel }: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const urgent = kind === 'review';
  const done = kind === 'delivered';
  const ready = kind === 'ready';
  const caption = t(ORDER_STATION_CAPTION_KEY[kind]);

  return (
    <View
      style={{
        width: 64,
        borderRadius: theme.radius.lg,
        backgroundColor: urgent ? colors.warningSoft : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: done || ready ? colors.success : urgent ? colors.warning : colors.border,
        overflow: 'hidden',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          alignSelf: 'stretch',
          paddingVertical: 4,
          paddingHorizontal: 4,
          backgroundColor: urgent ? `${colors.warning}22` : colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: urgent ? colors.warning : colors.border,
          alignItems: 'center',
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          numberOfLines={1}
          style={{
            color: colors.brand,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            letterSpacing: locale === 'ar' ? 0 : 0.4,
            fontSize: 9,
          }}
        >
          {caption === ORDER_STATION_CAPTION_KEY[kind] ? kind : caption}
        </AppText>
      </View>
      <View style={{ paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center', gap: 2 }}>
        <AppText
          weight={titleWeight}
          dir="ltr"
          style={{
            fontSize: 18,
            lineHeight: locale === 'ar' ? 26 : 22,
            color: colors.textPrimary,
            fontVariant: ['tabular-nums'],
          }}
        >
          {progressLabel}
        </AppText>
        <AppText
          variant="caption"
          numberOfLines={1}
          align="center"
          style={{
            color: urgent ? colors.warning : done ? colors.success : colors.textMuted,
            fontSize: 9,
            lineHeight: 12,
          }}
        >
          {t('mobile.orders.progress')}
        </AppText>
      </View>
    </View>
  );
}
