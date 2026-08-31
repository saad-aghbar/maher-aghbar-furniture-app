import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { InlineDateCalendar } from '@/components/calendar';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerFormFooter } from '@/features/dealers/components/dealerSheetForm';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { buildDueIso, hoursMinutesToTotalMinutes } from '@/features/tasks/formatDuration';
import type { AssignableWorker, RecommendBand } from '@/api/modules/production';
import {
  defaultAssignWindowParts,
  parseScheduleConflicts,
  parseSuggestedWindow,
  type ScheduleConflictItem,
} from '../assignWindow';
import { productionInsetStyle } from '../productionFloorStyle';
import { AssignConflictBoard } from './AssignConflictBoard';
import { HoursMinutesRow } from './HoursMinutesRow';

export type AssignWorkerPayload = {
  employeeId: string;
  plannedStart?: string;
  plannedCompletion?: string;
  estimatedMinutes?: number;
  overrideConflict?: boolean;
};

export type AssignScheduleConflict = {
  conflicts: ScheduleConflictItem[];
  suggestedWindow?: { plannedStart: string; plannedCompletion: string } | null;
};

type AssignWorkerSheetProps = {
  open: boolean;
  onClose: () => void;
  workers: AssignableWorker[];
  loading?: boolean;
  title: string;
  currentEmployeeId?: string | null;
  initialPlannedStart?: string | null;
  initialPlannedCompletion?: string | null;
  initialEstimatedMinutes?: number | null;
  /** When true, conflict-band workers can be submitted with overrideConflict. */
  canOverrideConflict?: boolean;
  /** Server conflict from a failed assign — keep sheet open and guide time change. */
  scheduleConflict?: AssignScheduleConflict | null;
  onClearScheduleConflict?: () => void;
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

function applyIsoWindow(
  plannedStart: string,
  plannedCompletion: string,
  setters: {
    setStartDate: (v: string) => void;
    setStartHour: (v: string) => void;
    setStartMinute: (v: string) => void;
    setDueDate: (v: string) => void;
    setDueHour: (v: string) => void;
    setDueMinute: (v: string) => void;
  },
) {
  const parts = defaultAssignWindowParts({
    plannedStart,
    plannedCompletion,
  });
  setters.setStartDate(parts.start.ymd);
  setters.setStartHour(parts.start.hour);
  setters.setStartMinute(parts.start.minute);
  setters.setDueDate(parts.due.ymd);
  setters.setDueHour(parts.due.hour);
  setters.setDueMinute(parts.due.minute);
}

export function AssignWorkerSheet({
  open,
  onClose,
  workers,
  loading,
  title,
  currentEmployeeId,
  initialPlannedStart,
  initialPlannedCompletion,
  initialEstimatedMinutes,
  canOverrideConflict = false,
  scheduleConflict = null,
  onClearScheduleConflict,
  onWindowChange,
  onSubmit,
}: AssignWorkerSheetProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(currentEmployeeId ?? '');
  const [startDate, setStartDate] = useState(todayYmdFallback());
  const [startHour, setStartHour] = useState('8');
  const [startMinute, setStartMinute] = useState('00');
  const [dueDate, setDueDate] = useState(todayYmdFallback());
  const [dueHour, setDueHour] = useState('10');
  const [dueMinute, setDueMinute] = useState('00');
  const [estHours, setEstHours] = useState('');
  const [estMinutes, setEstMinutes] = useState('');
  const [overrideConflict, setOverrideConflict] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(currentEmployeeId ?? '');
    const parts = defaultAssignWindowParts({
      plannedStart: initialPlannedStart,
      plannedCompletion: initialPlannedCompletion,
      estimatedMinutes: initialEstimatedMinutes,
    });
    setStartDate(parts.start.ymd);
    setStartHour(parts.start.hour);
    setStartMinute(parts.start.minute);
    setDueDate(parts.due.ymd);
    setDueHour(parts.due.hour);
    setDueMinute(parts.due.minute);
    setEstHours(parts.estHours);
    setEstMinutes(parts.estMinutes);
    setOverrideConflict(false);
    setQ('');
  }, [open, currentEmployeeId, initialPlannedStart, initialPlannedCompletion, initialEstimatedMinutes]);

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
  const serverConflicts = parseScheduleConflicts(scheduleConflict?.conflicts);
  const showConflictPanel = selectedIsConflict || serverConflicts.length > 0;

  const suggested =
    parseSuggestedWindow(scheduleConflict?.suggestedWindow) ??
    selectedWorker?.suggestedWindow ??
    null;

  const applySuggested = () => {
    if (!suggested) return;
    applyIsoWindow(suggested.plannedStart, suggested.plannedCompletion, {
      setStartDate,
      setStartHour,
      setStartMinute,
      setDueDate,
      setDueHour,
      setDueMinute,
    });
    setOverrideConflict(false);
    onClearScheduleConflict?.();
  };

  const submit = () => {
    if (!selectedId) return;
    if (selectedIsConflict && !canOverrideConflict && !overrideConflict) {
      // Prefer fixing the window — don't submit into a known conflict.
      return;
    }
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
    (selectedIsConflict || serverConflicts.length > 0) &&
    (!canOverrideConflict || !overrideConflict);

  return (
    <BottomSheet open={open} onClose={onClose} title={title} fitContent>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.md }}
      >
        <DealerBoard title={t('mobile.production.searchWorkers')} titleWeight={titleWeight}>
          <TextField
            value={q}
            onChangeText={setQ}
            placeholder={t('mobile.production.searchWorkers')}
            autoCorrect={false}
            returnKeyType="search"
          />
          <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
            <View style={{ gap: theme.spacing.md }}>
              {grouped.map((group) => (
                <View key={group.band ?? 'all'} style={{ gap: theme.spacing.sm }}>
                  {group.band ? (
                    <AppText
                      variant="caption"
                      weight={titleWeight}
                      style={{ color: colors.brand }}
                    >
                      {t(bandLabelKey(group.band))}
                    </AppText>
                  ) : null}
                  {group.workers.map((w) => {
                    const selected = w.id === selectedId;
                    const name = `${w.firstName} ${w.lastName}`.trim();
                    const conflict = w.recommendBand === 'conflict';
                    return (
                      <AnimatedPressable
                        key={w.id}
                        variant="button"
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        onPress={() => {
                          void haptics.selection();
                          setSelectedId(w.id);
                          setOverrideConflict(false);
                          onClearScheduleConflict?.();
                        }}
                        style={{
                          minHeight: theme.sizes.touch.min,
                          borderRadius: theme.radius.lg,
                          borderWidth: 1,
                          borderColor: selected
                            ? conflict
                              ? colors.warning
                              : colors.brand
                            : colors.border,
                          backgroundColor: selected
                            ? conflict
                              ? colors.surfaceSecondary
                              : colors.surface
                            : colors.surface,
                          paddingHorizontal: theme.spacing.md,
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: theme.spacing.sm,
                        }}
                      >
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: conflict ? colors.warning : colors.brand,
                            opacity: selected ? 1 : 0.35,
                          }}
                        />
                        <View style={{ flex: 1, gap: 2 }}>
                          <AppText
                            variant="label"
                            weight={titleWeight}
                            style={{
                              color: conflict ? colors.warning : colors.textPrimary,
                              textAlign: isRTL ? 'right' : 'left',
                            }}
                          >
                            {name}
                          </AppText>
                          {w.recommendReason ? (
                            <AppText
                              variant="caption"
                              color={conflict ? 'warning' : 'secondary'}
                              numberOfLines={2}
                              style={{ textAlign: isRTL ? 'right' : 'left' }}
                            >
                              {w.recommendReason}
                            </AppText>
                          ) : w.activeTaskCount != null ? (
                            <AppText
                              variant="caption"
                              color="muted"
                              style={{ textAlign: isRTL ? 'right' : 'left' }}
                            >
                              {t('mobile.production.activeTasksCount', {
                                count: w.activeTaskCount,
                              })}
                            </AppText>
                          ) : null}
                        </View>
                        {selected ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={conflict ? colors.warning : colors.brand}
                          />
                        ) : null}
                      </AnimatedPressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </DealerBoard>

        {showConflictPanel ? (
          <AssignConflictBoard
            overlaps={selectedWorker?.overlapWindows}
            conflicts={serverConflicts}
            reason={selectedWorker?.recommendReason}
            canOverride={canOverrideConflict}
            overrideChecked={overrideConflict}
            onToggleOverride={() => setOverrideConflict((v) => !v)}
            hasSuggestedSlot={Boolean(suggested)}
            onUseSuggestedSlot={applySuggested}
          />
        ) : null}

        <DealerBoard
          title={t('mobile.production.taskWindowTitle')}
          titleWeight={titleWeight}
        >
          <AppText variant="caption" color="muted">
            {t('mobile.production.taskWindowHint')}
          </AppText>
          <View style={productionInsetStyle(theme, colors)}>
            <AppText variant="caption" weight={titleWeight} color="secondary">
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
            <AppText
              variant="caption"
              weight={titleWeight}
              color="secondary"
              style={{ marginTop: theme.spacing.sm }}
            >
              {t('mobile.production.dueDate')}
            </AppText>
            <InlineDateCalendar
              value={dueDate}
              onSelect={setDueDate}
              resetKey={`${open}-due`}
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
          </View>
        </DealerBoard>

        <DealerFormFooter
          confirmLabel={
            conflictBlocksSubmit
              ? t('mobile.production.fixWindowThenAssign')
              : t('mobile.production.confirmAssign')
          }
          onConfirm={submit}
          onCancel={onClose}
          loading={loading}
          disabled={!selectedId || Boolean(loading) || conflictBlocksSubmit}
        />
      </ScrollView>
    </BottomSheet>
  );
}

function todayYmdFallback(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
