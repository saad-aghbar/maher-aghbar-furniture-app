import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import {
  RECEIPT_STUB_CAPTION_KEY,
  type DealerReceiptKind,
} from '../selectDealerReceipts';

type Props = {
  kind: DealerReceiptKind;
  ymd: string | null;
};

function monthLabel(ymd: string, locale: string): string {
  const date = new Date(`${ymd}T12:00:00`);
  const tag = locale === 'ar' ? 'ar-u-nu-latn' : locale === 'he' ? 'he-u-nu-latn' : 'en-GB';
  return new Intl.DateTimeFormat(tag, { month: 'short' }).format(date);
}

/** Receipt stub — awaiting / received + day, not station % or a promised calendar. */
export function DealerReceiptStub({ kind, ymd }: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const awaiting = kind === 'awaiting';
  const done = kind === 'received';
  const hasDay = Boolean(ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd));

  return (
    <View
      style={{
        width: 64,
        borderRadius: theme.radius.lg,
        backgroundColor: awaiting ? colors.warningSoft : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: done ? colors.success : awaiting ? colors.warning : colors.border,
        overflow: 'hidden',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          alignSelf: 'stretch',
          paddingVertical: 4,
          backgroundColor: awaiting ? `${colors.warning}22` : colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: awaiting ? colors.warning : colors.border,
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
            fontSize: 10,
          }}
        >
          {hasDay && ymd ? monthLabel(ymd, locale) : '—'}
        </AppText>
      </View>
      <View style={{ paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center', gap: 2 }}>
        <AppText
          weight={titleWeight}
          dir="ltr"
          style={{
            fontSize: 22,
            lineHeight: locale === 'ar' ? 30 : 26,
            color: colors.textPrimary,
            fontVariant: ['tabular-nums'],
          }}
        >
          {hasDay && ymd ? String(Number(ymd.slice(8, 10))) : '—'}
        </AppText>
        <AppText
          variant="caption"
          numberOfLines={2}
          align="center"
          style={{
            color: awaiting ? colors.warning : done ? colors.success : colors.textMuted,
            fontSize: 9,
            lineHeight: 12,
          }}
        >
          {t(RECEIPT_STUB_CAPTION_KEY[kind])}
        </AppText>
      </View>
    </View>
  );
}
