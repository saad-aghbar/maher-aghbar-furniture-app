import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { hoursMinutesToTotalMinutes, totalMinutesToHoursMinutes } from '@/features/tasks/formatDuration';
import { useTheme } from '@/theme';

type Props = {
  open: boolean;
  onClose: () => void;
  stageName: string;
  initialMinutes: number | null | undefined;
  saving?: boolean;
  onSave: (minutes: number) => void | Promise<void>;
};

export function StageDurationSheet({
  open,
  onClose,
  stageName,
  initialMinutes,
  saving = false,
  onSave,
}: Props) {
  const { t } = useLocale();
  const { theme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const parts = totalMinutesToHoursMinutes(Math.max(0, Number(initialMinutes ?? 0)));
    setHours(String(parts.hours));
    setMinutes(String(parts.minutes || (initialMinutes ? 0 : 30)));
    setError(null);
  }, [initialMinutes, open]);

  async function handleSave() {
    const h = Number(hours);
    const m = Number(minutes);
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0 || m > 59) {
      setError(t('mobile.production.workflow.invalidStageDuration'));
      return;
    }
    const total = hoursMinutesToTotalMinutes(h, m);
    if (total <= 0) {
      setError(t('mobile.production.workflow.invalidStageDuration'));
      return;
    }
    setError(null);
    await onSave(total);
  }

  return (
    <BottomSheet open={open} onClose={onClose} fitContent>
      <View style={{ gap: theme.spacing.md, paddingBottom: Math.max(insets.bottom, theme.spacing.md) }}>
        <View style={{ gap: 4 }}>
          <AppText variant="title" weight="semibold">
            {t('mobile.production.workflow.stageDurationTitle')}
          </AppText>
          <AppText variant="caption" color="muted">
            {stageName}
          </AppText>
          <AppText variant="caption" color="muted">
            {t('mobile.production.workflow.stageDurationHint')}
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="caption" color="muted">
              {t('mobile.production.workflow.durationHours')}
            </AppText>
            <TextField
              value={hours}
              onChangeText={setHours}
              keyboardType="number-pad"
              placeholder="0"
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="caption" color="muted">
              {t('mobile.production.workflow.durationMinutes')}
            </AppText>
            <TextField
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
              placeholder="30"
            />
          </View>
        </View>

        {error ? (
          <AppText variant="caption" style={{ color: colors.error }}>
            {error}
          </AppText>
        ) : null}

        <PrimaryButton
          label={t('mobile.production.workflow.saveStageDuration')}
          onPress={() => void handleSave()}
          loading={saving}
          disabled={saving}
        />
      </View>
    </BottomSheet>
  );
}
