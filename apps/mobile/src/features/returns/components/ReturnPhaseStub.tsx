import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { returnListDay, type ReturnLifecyclePhase } from '../selectReturn';

type Props = {
  createdAt?: string | null;
  phase: ReturnLifecyclePhase;
};

function monthLabel(ymd: string, locale: string): string {
  const date = new Date(`${ymd}T12:00:00`);
  const tag = locale === 'ar' ? 'ar-u-nu-latn' : locale === 'he' ? 'he-u-nu-latn' : 'en-GB';
  return new Intl.DateTimeFormat(tag, { month: 'short' }).format(date);
}

/**
 * Return ticket stub — filed date + short lifecycle, not a quote validity calendar.
 */
export function ReturnPhaseStub({ createdAt, phase }: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const ymd = returnListDay(createdAt);
  const hasDay = /^\d{4}-\d{2}-\d{2}$/.test(ymd);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const urgent = phase === 'REPORTED' || phase === 'UNDER_REVIEW' || phase === 'WAITING_RETURN';
  const done = phase === 'RESOLVED';
  const caption = t(`mobile.returns.stubPhase.${phase}`);

  return (
    <View
      style={{
        width: 64,
        borderRadius: theme.radius.lg,
        backgroundColor: urgent ? colors.warningSoft : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: done ? colors.success : urgent ? colors.warning : colors.border,
        overflow: 'hidden',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          alignSelf: 'stretch',
          paddingVertical: 4,
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
            fontSize: 10,
          }}
        >
          {hasDay ? monthLabel(ymd, locale) : '—'}
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
          {hasDay ? String(Number(ymd.slice(8, 10))) : '—'}
        </AppText>
        <AppText
          variant="caption"
          numberOfLines={2}
          align="center"
          style={{
            color: urgent ? colors.warning : done ? colors.success : colors.textMuted,
            fontSize: 9,
            lineHeight: 12,
          }}
        >
          {caption === `mobile.returns.stubPhase.${phase}` ? phase.replace(/_/g, ' ') : caption}
        </AppText>
      </View>
    </View>
  );
}
