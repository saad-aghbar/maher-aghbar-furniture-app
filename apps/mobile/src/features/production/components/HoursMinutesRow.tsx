import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type HoursMinutesRowProps = {
  hours: string;
  minutes: string;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
  hoursLabel: string;
  minutesLabel: string;
  /** Optional section caption above the pair (e.g. “Time”). */
  sectionLabel?: string;
};

function clampDigits(raw: string, max: number): string {
  const digits = raw.replace(/\D/g, '').slice(0, 2);
  if (digits === '') return '';
  const n = Math.min(max, Number(digits));
  return String(Number.isFinite(n) ? n : 0);
}

/**
 * Clear HH : MM pair with labels — reads as a clock, not two mystery boxes.
 */
export function HoursMinutesRow({
  hours,
  minutes,
  onHoursChange,
  onMinutesChange,
  hoursLabel,
  minutesLabel,
  sectionLabel,
}: HoursMinutesRowProps) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {sectionLabel ? (
        <AppText variant="caption" color="muted">
          {sectionLabel}
        </AppText>
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <AppText
            variant="caption"
            weight="semibold"
            style={{ color: colors.textSecondary, fontSize: 11 }}
          >
            {hoursLabel}
          </AppText>
          <TextField
            value={hours}
            onChangeText={(v) => onHoursChange(clampDigits(v, 23))}
            placeholder="00"
            keyboardType="number-pad"
            maxLength={2}
            style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }}
          />
        </View>

        <AppText
          variant="title"
          weight="semibold"
          style={{
            color: colors.textMuted,
            paddingBottom: theme.spacing.md + 2,
            minWidth: 12,
            textAlign: 'center',
          }}
        >
          :
        </AppText>

        <View style={{ flex: 1, gap: 4 }}>
          <AppText
            variant="caption"
            weight="semibold"
            style={{ color: colors.textSecondary, fontSize: 11 }}
          >
            {minutesLabel}
          </AppText>
          <TextField
            value={minutes}
            onChangeText={(v) => onMinutesChange(clampDigits(v, 59))}
            placeholder="00"
            keyboardType="number-pad"
            maxLength={2}
            style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }}
          />
        </View>
      </View>
    </View>
  );
}
