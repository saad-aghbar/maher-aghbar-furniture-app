import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { InlineDateCalendar, todayYmd } from '@/components/calendar';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { buildDueIso, hoursMinutesToTotalMinutes } from '@/features/tasks/formatDuration';
import type { AssignableWorker, RecommendBand } from '@/api/modules/production';
import { HoursMinutesRow } from './HoursMinutesRow';

export type AssignWorkerPayload = {
  employeeId: string;
  plannedStart?: string;
  plannedCompletion?: string;
  estimatedMinutes?: number;
  overrideConflict?: boolean;
};

type AssignWorkerSheetProps = {
  open: boolean;
  onClose: () => void;
  workers: AssignableWorker[];
  loading?: boolean;
  title: string;
  currentEmployeeId?: string | null;
  /** When true, conflict-band workers can be submitted with overrideConflict. */
  canOverrideConflict?: boolean;
  /** Notify parent when date window changes so assignable-workers can refetch conflicts. */
  onWindowChange?: (window: {
    plannedStart?: string;
    plannedCompletion?: string;
  }) => void;
  onSubmit: (payload: AssignWorkerPayload) => void;
};

const BAND_ORDER: RecommendBand[] = ['recommended', 'busy', 'conflict', 'other'];

function bandLabelKey(band: RecommendBand): string {
  switch (band) {
    case 'recommended':
      return 'mobile.production.recommendRecommended';
    case 'busy':
      return 'mobile.production.recommendBusy';
    case 'conflict':
      return 'mobile.production.recommendConflict';
    default:
      return 'mobile.production.recommendOther';
  }
}

export function AssignWorkerSheet({
  open,
  onClose,
  workers,
  loading,
  title,
  currentEmployeeId,
  canOverrideConflict = false,
  onWindowChange,
  onSubmit,
}: AssignWorkerSheetProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(currentEmployeeId ?? '');
  const [startDate, setStartDate] = useState(todayYmd());
  const [startHour, setStartHour] = useState('8');
  const [startMinute, setStartMinute] = useState('00');
  const [dueDate, setDueDate] = useState(todayYmd());
  const [dueHour, setDueHour] = useState('17');
  const [dueMinute, setDueMinute] = useState('00');
  const [estHours, setEstHours] = useState('');
  const [estMinutes, setEstMinutes] = useState('');
  const [overrideConflict, setOverrideConflict] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(currentEmployeeId ?? '');
    setStartDate(todayYmd());
    setStartHour('8');
    setStartMinute('00');
    setDueDate(todayYmd());
    setDueHour('17');
    setDueMinute('00');
    setEstHours('');
    setEstMinutes('');
    setOverrideConflict(false);
    setQ('');
  }, [open, currentEmployeeId]);

  // Debounce date window → parent refetch for conflict recommendations
  useEffect(() => {
    if (!open || !onWindowChange) return;
    const id = setTimeout(() => {
      const plannedStart = buildDueIso(
        startDate.trim(),
        Number(startHour) || 0,
        Number(startMinute) || 0,
      );
      const plannedCompletion = buildDueIso(
        dueDate.trim(),
        Number(dueHour) || 0,
        Number(dueMinute) || 0,
      );
      onWindowChange({
        ...(plannedStart ? { plannedStart } : {}),
        ...(plannedCompletion ? { plannedCompletion } : {}),
      });
    }, 250);
    return () => clearTimeout(id);
  }, [
    open,
    onWindowChange,
    startDate,
    startHour,
    startMinute,
    dueDate,
    dueHour,
    dueMinute,
  ]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return workers.filter((w) => {
      const name = `${w.firstName} ${w.lastName} ${w.email ?? ''}`.toLowerCase();
      return !needle || name.includes(needle);
    });
  }, [q, workers]);

  const grouped = useMemo(() => {
    const hasBands = filtered.some((w) => w.recommendBand);
    if (!hasBands) {
      const sorted = [...filtered].sort((a, b) => {
        const ac = a.activeTaskCount ?? 0;
        const bc = b.activeTaskCount ?? 0;
        if (ac !== bc) return ac - bc;
        return `${a.firstName} ${a.lastName}`.trim().localeCompare(
          `${b.firstName} ${b.lastName}`.trim(),
        );
      });
      return [{ band: null as RecommendBand | null, workers: sorted }];
    }
    return BAND_ORDER.map((band) => ({
      band,
      workers: filtered
        .filter((w) => (w.recommendBand ?? 'other') === band)
        .sort((a, b) =>
          `${a.firstName} ${a.lastName}`.trim().localeCompare(
            `${b.firstName} ${b.lastName}`.trim(),
          ),
        ),
    })).filter((g) => g.workers.length > 0);
  }, [filtered]);

  const selectedWorker = useMemo(
    () => workers.find((w) => w.id === selectedId) ?? null,
    [selectedId, workers],
  );
  const selectedIsConflict = selectedWorker?.recommendBand === 'conflict';

  const submit = () => {
    if (!selectedId) return;
    if (selectedIsConflict && !canOverrideConflict) return;
    if (selectedIsConflict && canOverrideConflict && !overrideConflict) return;

    const plannedStart = buildDueIso(
      startDate.trim(),
      Number(startHour) || 0,
      Number(startMinute) || 0,
    );
    const plannedCompletion = buildDueIso(
      dueDate.trim(),
      Number(dueHour) || 0,
      Number(dueMinute) || 0,
    );
    const eh = Number(estHours);
    const em = Number(estMinutes);
    const estimatedMinutes =
      Number.isFinite(eh) || Number.isFinite(em)
        ? hoursMinutesToTotalMinutes(
            Number.isFinite(eh) ? eh : 0,
            Number.isFinite(em) ? em : 0,
          )
        : undefined;
    onSubmit({
      employeeId: selectedId,
      ...(plannedStart ? { plannedStart } : {}),
      ...(plannedCompletion ? { plannedCompletion } : {}),
      ...(estimatedMinutes != null && estimatedMinutes > 0
        ? { estimatedMinutes }
        : {}),
      ...(selectedIsConflict && overrideConflict ? { overrideConflict: true } : {}),
    });
  };

  const conflictBlocksSubmit =
    selectedIsConflict && (!canOverrideConflict || !overrideConflict);

  return (
    <BottomSheet open={open} onClose={onClose} title={title} fitContent>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.md }}
      >
        <TextField
          value={q}
          onChangeText={setQ}
          placeholder={t('mobile.production.searchWorkers')}
          autoCorrect={false}
          returnKeyType="search"
        />
        <ScrollView style={{ maxHeight: 280 }}>
          <View style={{ gap: theme.spacing.md }}>
            {grouped.map((group) => (
              <View key={group.band ?? 'all'} style={{ gap: theme.spacing.sm }}>
                {group.band ? (
                  <AppText
                    variant="caption"
                    weight="semibold"
                    style={{ color: colors.brand }}
                  >
                    {t(bandLabelKey(group.band))}
                  </AppText>
                ) : null}
                {group.workers.map((w) => {
                  const selected = w.id === selectedId;
                  const name = `${w.firstName} ${w.lastName}`.trim();
                  const activeCount = w.activeTaskCount ?? 0;
                  const conflict = w.recommendBand === 'conflict';
                  return (
                    <Pressable
                      key={w.id}
                      onPress={() => {
                        setSelectedId(w.id);
                        setOverrideConflict(false);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={{
                        minHeight: 72,
                        borderWidth: 1,
                        borderColor: selected
                          ? conflict
                            ? colors.error
                            : colors.brand
                          : colors.borderMuted,
                        backgroundColor: selected
                          ? conflict
                            ? colors.errorSoft
                            : colors.brandSoft
                          : colors.surfaceElevated,
                        borderRadius: theme.radius.lg,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm,
                        justifyContent: 'center',
                        gap: 2,
                      }}
                    >
                      <AppText
                        weight={selected ? 'semibold' : 'regular'}
                        style={{ textAlign: isRTL ? 'right' : 'left', width: '100%' }}
                      >
                        {name}
                      </AppText>
                      {w.recommendReason ? (
                        <AppText
                          variant="caption"
                          color={conflict ? 'error' : 'secondary'}
                          numberOfLines={2}
                          style={{ textAlign: isRTL ? 'right' : 'left', width: '100%' }}
                        >
                          {w.recommendReason}
                        </AppText>
                      ) : null}
                      <View
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          flexWrap: 'wrap',
                          gap: theme.spacing.sm,
                          alignItems: 'center',
                          alignSelf: isRTL ? 'flex-end' : 'flex-start',
                        }}
                      >
                        {w.department ? (
                          <AppText variant="caption" color="secondary">
                            {w.department.nameEn}
                          </AppText>
                        ) : null}
                        <AppText variant="caption" color="muted">
                          {t('mobile.production.activeTasks', { count: activeCount })}
                        </AppText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {filtered.length === 0 ? (
              <AppText variant="caption" color="secondary">
                {t('mobile.production.noWorkers')}
              </AppText>
            ) : null}
          </View>
        </ScrollView>

        {selectedIsConflict ? (
          <View
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.error,
              backgroundColor: colors.errorSoft,
              gap: theme.spacing.sm,
            }}
          >
            <AppText variant="caption" weight="semibold" style={{ color: colors.error }}>
              {t('mobile.production.conflictWarningTitle')}
            </AppText>
            <AppText variant="caption" style={{ color: colors.error }}>
              {selectedWorker?.recommendReason ||
                t('mobile.production.conflictWarningBody')}
            </AppText>
            {canOverrideConflict ? (
              <Pressable
                onPress={() => setOverrideConflict((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: overrideConflict }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  minHeight: 44,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 1.5,
                    borderColor: colors.error,
                    backgroundColor: overrideConflict ? colors.error : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {overrideConflict ? (
                    <AppText variant="caption" weight="semibold" style={{ color: '#fff' }}>
                      ✓
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="caption" style={{ flex: 1, color: colors.error }}>
                  {t('mobile.production.overrideConflict')}
                </AppText>
              </Pressable>
            ) : (
              <AppText variant="caption" color="muted">
                {t('mobile.production.conflictNoOverride')}
              </AppText>
            )}
          </View>
        ) : null}

        <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
          {t('mobile.production.startDate')}
        </AppText>
        <InlineDateCalendar value={startDate} onSelect={setStartDate} resetKey={open} />
        <HoursMinutesRow
          sectionLabel={t('mobile.production.startTime')}
          hours={startHour}
          minutes={startMinute}
          onHoursChange={setStartHour}
          onMinutesChange={setStartMinute}
          hoursLabel={t('mobile.production.dueHour')}
          minutesLabel={t('mobile.production.dueMinute')}
        />

        <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
          {t('mobile.production.dueDate')}
        </AppText>
        <InlineDateCalendar value={dueDate} onSelect={setDueDate} resetKey={`${open}-due`} />
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
          disabled={!selectedId || loading || conflictBlocksSubmit}
          onPress={submit}
        />
        <SecondaryButton label={t('mobile.production.cancel')} onPress={onClose} />
      </ScrollView>
    </BottomSheet>
  );
}
