import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { buildDueIso, hoursMinutesToTotalMinutes } from '@/features/tasks/formatDuration';
import type { AssignableWorker } from '../api';
import { HoursMinutesRow } from './HoursMinutesRow';

export type AssignWorkerPayload = {
  employeeId: string;
  plannedCompletion?: string;
  estimatedMinutes?: number;
};

type AssignWorkerSheetProps = {
  open: boolean;
  onClose: () => void;
  workers: AssignableWorker[];
  loading?: boolean;
  title: string;
  currentEmployeeId?: string | null;
  onSubmit: (payload: AssignWorkerPayload) => void;
};

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function AssignWorkerSheet({
  open,
  onClose,
  workers,
  loading,
  title,
  currentEmployeeId,
  onSubmit,
}: AssignWorkerSheetProps) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(currentEmployeeId ?? '');
  const [dueDate, setDueDate] = useState(todayYmd());
  const [dueHour, setDueHour] = useState('17');
  const [dueMinute, setDueMinute] = useState('00');
  const [estHours, setEstHours] = useState('');
  const [estMinutes, setEstMinutes] = useState('');

  const filtered = workers.filter((w) => {
    const name = `${w.firstName} ${w.lastName} ${w.email ?? ''}`.toLowerCase();
    return !q.trim() || name.includes(q.trim().toLowerCase());
  });

  const submit = () => {
    if (!selectedId) return;
    const plannedCompletion = buildDueIso(
      dueDate.trim(),
      Number(dueHour) || 0,
      Number(dueMinute) || 0,
    );
    const eh = Number(estHours);
    const em = Number(estMinutes);
    const estimatedMinutes =
      Number.isFinite(eh) || Number.isFinite(em)
        ? hoursMinutesToTotalMinutes(Number.isFinite(eh) ? eh : 0, Number.isFinite(em) ? em : 0)
        : undefined;
    onSubmit({
      employeeId: selectedId,
      ...(plannedCompletion ? { plannedCompletion } : {}),
      ...(estimatedMinutes != null && estimatedMinutes > 0 ? { estimatedMinutes } : {}),
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={title} sheetHeight={620}>
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <TextField
          value={q}
          onChangeText={setQ}
          placeholder={t('mobile.production.searchWorkers')}
          autoCorrect={false}
          returnKeyType="search"
        />
        <ScrollView style={{ maxHeight: 180 }}>
          <View style={{ gap: theme.spacing.sm }}>
            {filtered.map((w) => {
              const selected = w.id === selectedId;
              const name = `${w.firstName} ${w.lastName}`.trim();
              return (
                <Pressable
                  key={w.id}
                  onPress={() => setSelectedId(w.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={{
                    minHeight: theme.sizes.touch.min,
                    borderWidth: 1,
                    borderColor: selected ? colors.brand : colors.border,
                    backgroundColor: selected ? colors.brandSoft : colors.surface,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.spacing.md,
                    justifyContent: 'center',
                  }}
                >
                  <AppText weight={selected ? 'semibold' : 'regular'}>{name}</AppText>
                  {w.department ? (
                    <AppText variant="caption" color="secondary">
                      {w.department.nameEn}
                    </AppText>
                  ) : null}
                </Pressable>
              );
            })}
            {filtered.length === 0 ? (
              <AppText variant="caption" color="secondary">
                {t('mobile.production.noWorkers')}
              </AppText>
            ) : null}
          </View>
        </ScrollView>

        <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
          {t('mobile.production.dueDate')}
        </AppText>
        <TextField
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="YYYY-MM-DD"
          autoCorrect={false}
        />
        <HoursMinutesRow
          sectionLabel={t('mobile.production.dueTime')}
          hours={dueHour}
          minutes={dueMinute}
          onHoursChange={setDueHour}
          onMinutesChange={setDueMinute}
          hoursLabel={t('mobile.production.dueHour')}
          minutesLabel={t('mobile.production.dueMinute')}
        />
        <HoursMinutesRow
          sectionLabel={t('mobile.production.estimateDuration')}
          hours={estHours}
          minutes={estMinutes}
          onHoursChange={setEstHours}
          onMinutesChange={setEstMinutes}
          hoursLabel={t('mobile.production.estimateHours')}
          minutesLabel={t('mobile.production.estimateMinutes')}
        />

        <PrimaryButton
          label={t('mobile.production.confirmAssign')}
          loading={loading}
          disabled={!selectedId || loading}
          onPress={submit}
        />
        <SecondaryButton label={t('mobile.production.cancel')} onPress={onClose} />
      </View>
    </BottomSheet>
  );
}
