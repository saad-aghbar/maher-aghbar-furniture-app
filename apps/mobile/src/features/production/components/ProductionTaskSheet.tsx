import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { InlineDateCalendar } from '@/components/calendar';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { productionInsetStyle } from '../productionFloorStyle';
import {
  defaultAssignWindowParts,
  parseScheduleConflicts,
  parseSuggestedWindow,
} from '../assignWindow';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AssignableWorker, ProductionPriority } from '../api';
import type { ProductionTaskRow } from '../selectProduction';
import { workersForStage } from '../selectProduction';
import type { AssignScheduleConflict } from './AssignWorkerSheet';
import { AssignConflictBoard } from './AssignConflictBoard';
import { PriorityTouchBar } from './PriorityTouchBar';
import { HoursMinutesRow } from './HoursMinutesRow';
import {
  buildDueIso,
  formatMinutesDuration,
  hoursMinutesToTotalMinutes,
} from '@/features/tasks/formatDuration';

type SheetMode = 'detail' | 'workers' | 'block';

type ProductionTaskSheetProps = {
  open: boolean;
  onClose: () => void;
  task: ProductionTaskRow | null;
  workers: AssignableWorker[];
  workersLoading?: boolean;
  canAssign: boolean;
  canUpdateTask: boolean;
  canOverrideConflict?: boolean;
  assignLoading?: boolean;
  notesLoading?: boolean;
  holdLoading?: boolean;
  blockLoading?: boolean;
  scheduleConflict?: AssignScheduleConflict | null;
  onClearScheduleConflict?: () => void;
  onWindowChange?: (window: {
    plannedStart?: string;
    plannedCompletion?: string;
  }) => void;
  onAssign: (payload: {
    employeeId: string;
    priority: string;
    plannedStart?: string;
    plannedCompletion?: string;
    estimatedMinutes?: number;
    overrideConflict?: boolean;
  }) => void;
  onSaveNotes: (notes: string) => void;
  onHold: () => void;
  onBlock: (reason: string) => void;
};

function priorityLabel(priority: string, t: (key: string) => string): string {
  const key = `mobile.production.priority.${priority}`;
  const label = t(key);
  return label === key ? priority : label;
}

function PillButton({
  label,
  onPress,
  variant = 'secondary',
  loading,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const busy = Boolean(loading);
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const ink = isPrimary
    ? colors.onBrand
    : isDanger
      ? colors.error
      : colors.textSecondary;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: Boolean(disabled) || busy }}
      disabled={disabled || busy}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        opacity: disabled || busy ? 0.55 : 1,
        backgroundColor: isPrimary
          ? colors.brand
          : isDanger
            ? colors.errorSoft
            : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: isPrimary
          ? colors.brand
          : isDanger
            ? colors.error
            : colors.border,
        ...(isPrimary && colorScheme !== 'dark'
          ? {
              shadowColor: colors.brand,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.24,
              shadowRadius: 10,
            }
          : null),
      }}
    >
      {busy ? (
        <ActivityIndicator color={isPrimary ? colors.onBrand : ink} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={ink} /> : null}
          <AppText
            variant="label"
            weight={isPrimary ? 'semibold' : 'medium'}
            style={{ color: ink }}
          >
            {label}
          </AppText>
        </>
      )}
    </AnimatedPressable>
  );
}

export function ProductionTaskSheet({
  open,
  onClose,
  task,
  workers,
  workersLoading = false,
  canAssign,
  canUpdateTask,
  canOverrideConflict = false,
  assignLoading,
  notesLoading,
  holdLoading,
  blockLoading,
  scheduleConflict = null,
  onClearScheduleConflict,
  onWindowChange,
  onAssign,
  onSaveNotes,
  onHold,
  onBlock,
}: ProductionTaskSheetProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + theme.spacing.md;
  const [mode, setMode] = useState<SheetMode>('detail');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<ProductionPriority>('NORMAL');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [workerQ, setWorkerQ] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [startDate, setStartDate] = useState(
    defaultAssignWindowParts().start.ymd,
  );
  const [startHour, setStartHour] = useState('8');
  const [startMinute, setStartMinute] = useState('00');
  const [dueDate, setDueDate] = useState(defaultAssignWindowParts().due.ymd);
  const [dueHour, setDueHour] = useState('10');
  const [dueMinute, setDueMinute] = useState('00');
  const [estHours, setEstHours] = useState('');
  const [estMinutes, setEstMinutes] = useState('');
  const [overrideConflict, setOverrideConflict] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    setMode('detail');
    setNotes(task.notes);
    setPriority((task.priority as ProductionPriority) || 'NORMAL');
    setSelectedWorkerId(task.assigneeId ?? '');
    setWorkerQ('');
    setBlockReason('');
    setOverrideConflict(false);
    onClearScheduleConflict?.();
    const parts = defaultAssignWindowParts({
      plannedStart: task.plannedStart,
      plannedCompletion: task.plannedCompletion,
      estimatedMinutes: task.estimatedMinutes,
    });
    setStartDate(parts.start.ymd);
    setStartHour(parts.start.hour);
    setStartMinute(parts.start.minute);
    setDueDate(parts.due.ymd);
    setDueHour(parts.due.hour);
    setDueMinute(parts.due.minute);
    setEstHours(parts.estHours);
    setEstMinutes(parts.estMinutes);
    // Only reset when the sheet opens or a different task is shown — not when the
    // same task refreshes after assign/notes (that was kicking users back to detail).
  }, [open, task?.id]);

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

  const stageWorkers = useMemo(
    () => workersForStage(workers, task?.responsibleDepartment),
    [workers, task?.responsibleDepartment],
  );

  const filteredWorkers = useMemo(() => {
    const q = workerQ.trim().toLowerCase();
    let list = stageWorkers;
    if (task?.assigneeId && !list.some((w) => w.id === task.assigneeId)) {
      const current = workers.find((w) => w.id === task.assigneeId);
      if (current) list = [current, ...list];
    }
    if (!q) return list;
    return list.filter((w) =>
      `${w.firstName} ${w.lastName} ${w.email ?? ''}`.toLowerCase().includes(q),
    );
  }, [stageWorkers, workers, task?.assigneeId, workerQ]);

  const draftWorker = useMemo(() => {
    if (!selectedWorkerId) return null;
    return (
      workers.find((w) => w.id === selectedWorkerId) ??
      stageWorkers.find((w) => w.id === selectedWorkerId) ??
      null
    );
  }, [selectedWorkerId, workers, stageWorkers]);

  const draftWorkerName = draftWorker
    ? `${draftWorker.firstName} ${draftWorker.lastName}`.trim()
    : null;

  const selectedIsConflict = draftWorker?.recommendBand === 'conflict';
  const serverConflicts = parseScheduleConflicts(scheduleConflict?.conflicts);
  const showConflictPanel = selectedIsConflict || serverConflicts.length > 0;
  const suggested =
    parseSuggestedWindow(scheduleConflict?.suggestedWindow) ??
    draftWorker?.suggestedWindow ??
    null;

  const applySuggested = () => {
    if (!suggested) return;
    const parts = defaultAssignWindowParts({
      plannedStart: suggested.plannedStart,
      plannedCompletion: suggested.plannedCompletion,
    });
    setStartDate(parts.start.ymd);
    setStartHour(parts.start.hour);
    setStartMinute(parts.start.minute);
    setDueDate(parts.due.ymd);
    setDueHour(parts.due.hour);
    setDueMinute(parts.due.minute);
    setOverrideConflict(false);
    onClearScheduleConflict?.();
  };

  const listMaxHeight = Math.round(Dimensions.get('window').height * 0.32);
  const bodyMaxHeight = Math.round(Dimensions.get('window').height * 0.55);

  if (!task) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t('mobile.production.taskDetail')}
        fitContent
      >
        <View />
      </BottomSheet>
    );
  }

  const pct = Math.max(0, Math.min(100, Math.round(task.progressPercent || 0)));
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const showAssign = canAssign && task.canAssign;
  const displayedWorkerName =
    draftWorkerName ?? task.assigneeName ?? t('mobile.production.unassigned');
  const conflictBlocksAssign =
    (selectedIsConflict || serverConflicts.length > 0) &&
    (!canOverrideConflict || !overrideConflict);
  const sheetTitle =
    mode === 'workers'
      ? t('mobile.production.assignWorker')
      : mode === 'block'
        ? t('mobile.production.block')
        : task.name;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={sheetTitle}
      fitContent
    >
      {mode === 'workers' ? (
        <View style={{ gap: theme.spacing.md, paddingBottom: bottomPad }}>
          <AppText variant="caption" color="muted">
            {task.responsibleDepartment
              ? t('mobile.production.workersForStage')
              : t('mobile.production.searchWorkers')}
          </AppText>
          <TextField
            value={workerQ}
            onChangeText={setWorkerQ}
            placeholder={t('mobile.production.searchWorkers')}
            autoCorrect={false}
            returnKeyType="search"
          />
          <ScrollView
            style={{ maxHeight: listMaxHeight }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <DealerBoard title={t('mobile.production.workersForStage')} titleWeight={titleWeight} contentStyle={{ padding: 0, gap: 0 }}>
            <View
              style={{
                overflow: 'hidden',
              }}
            >
              {filteredWorkers.map((w, index) => {
                const selected = w.id === selectedWorkerId;
                const name = `${w.firstName} ${w.lastName}`.trim();
                const last = index === filteredWorkers.length - 1;
                const conflict = w.recommendBand === 'conflict';
                return (
                  <View key={w.id}>
                    <AnimatedPressable
                      variant="button"
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        void haptics.selection();
                        setSelectedWorkerId(w.id);
                        setOverrideConflict(false);
                        onClearScheduleConflict?.();
                      }}
                      style={{
                        minHeight: theme.sizes.touch.min,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm + 2,
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: theme.spacing.md,
                        backgroundColor: selected ? colors.brandSoft : 'transparent',
                        overflow: 'hidden',
                      }}
                    >
                      {selected ? (
                        <View
                          pointerEvents="none"
                          style={{
                            position: 'absolute',
                            top: 8,
                            bottom: 8,
                            width: 3,
                            backgroundColor: conflict ? colors.warning : colors.brand,
                            ...(isRTL ? { right: 0 } : { left: 0 }),
                          }}
                        />
                      ) : null}
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: selected ? colors.brandSoft : colors.surface,
                          borderWidth: 1,
                          borderColor: selected
                            ? conflict
                              ? colors.warning
                              : colors.brand
                            : colors.border,
                        }}
                      >
                        <Ionicons
                          name="person"
                          size={16}
                          color={
                            selected
                              ? conflict
                                ? colors.warning
                                : colors.brand
                              : colors.textMuted
                          }
                        />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <AppText
                          variant="label"
                          weight={selected ? (locale === 'ar' ? 'medium' : 'semibold') : 'medium'}
                          style={{
                            color: selected
                              ? conflict
                                ? colors.warning
                                : colors.brand
                              : colors.textPrimary,
                          }}
                        >
                          {name}
                        </AppText>
                        {w.recommendReason ? (
                          <AppText
                            variant="caption"
                            color={conflict ? 'warning' : 'muted'}
                            numberOfLines={2}
                          >
                            {w.recommendReason}
                          </AppText>
                        ) : null}
                      </View>
                      {selected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={conflict ? colors.warning : colors.brand}
                        />
                      ) : (
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            borderWidth: 1.5,
                            borderColor: colors.borderStrong,
                          }}
                        />
                      )}
                    </AnimatedPressable>
                    {!last ? (
                      <View
                        style={{
                          height: 1,
                          backgroundColor: colors.border,
                          marginLeft: isRTL ? theme.spacing.md : 60,
                          marginRight: isRTL ? 60 : theme.spacing.md,
                        }}
                      />
                    ) : null}
                  </View>
                );
              })}
              {filteredWorkers.length === 0 ? (
                <View style={{ padding: theme.spacing.lg }}>
                  <AppText variant="caption" color="secondary">
                    {workersLoading
                      ? t('mobile.production.loadingWorkers')
                      : t('mobile.production.noWorkersForStage')}
                  </AppText>
                </View>
              ) : null}
            </View>
            </DealerBoard>
          </ScrollView>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <PillButton
                label={t('mobile.production.cancel')}
                variant="secondary"
                onPress={() => setMode('detail')}
              />
            </View>
            <View style={{ flex: 1.35 }}>
              <PillButton
                label={t('mobile.production.confirm')}
                variant="primary"
                disabled={!selectedWorkerId}
                icon="checkmark"
                onPress={() => {
                  if (!selectedWorkerId) return;
                  void haptics.selection();
                  // Keep selection and return to details — Assign there submits.
                  setMode('detail');
                }}
              />
            </View>
          </View>
        </View>
      ) : mode === 'block' ? (
        <View style={{ gap: theme.spacing.md, paddingBottom: bottomPad }}>
          <AppText variant="caption" color="muted">
            {t('mobile.production.blockReasonPrompt')}
          </AppText>
          <DealerBoard title={t('mobile.production.block')} titleWeight={titleWeight}>
            <TextField
              value={blockReason}
              onChangeText={setBlockReason}
              placeholder={t('mobile.production.blockReasonPlaceholder')}
              multiline
              numberOfLines={3}
              style={{ minHeight: 88, textAlignVertical: 'top' }}
            />
          </DealerBoard>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <PillButton
                label={t('mobile.production.cancel')}
                variant="secondary"
                onPress={() => setMode('detail')}
              />
            </View>
            <View style={{ flex: 1.35 }}>
              <PillButton
                label={t('mobile.production.block')}
                variant="primary"
                loading={blockLoading}
                disabled={!blockReason.trim()}
                icon="alert-circle-outline"
                onPress={() => {
                  if (!blockReason.trim()) return;
                  void haptics.confirmMedium();
                  onBlock(blockReason.trim());
                }}
              />
            </View>
          </View>
        </View>
      ) : (
        <ScrollView
          style={{ maxHeight: bodyMaxHeight }}
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: bottomPad,
          }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <DealerBoard title={t('mobile.production.taskDetail')} titleWeight={titleWeight}>
            <View
              style={{
                ...productionInsetStyle(theme, colors),
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <StatusBadge status={task.status} dot />
              <AppText variant="label" weight={titleWeight} dir="ltr">
                {pct}%
              </AppText>
              <StatusBadge
                status={task.priority}
                label={priorityLabel(task.priority, t)}
                dot
              />
            </View>
          </DealerBoard>

          {task.isCompleted || task.elapsedMinutes > 0 ? (
            <DealerBoard title={t('mobile.production.timeTaken')} titleWeight={titleWeight}>
              <View style={productionInsetStyle(theme, colors)}>
                <AppText variant="label" weight={titleWeight}>
                  {task.elapsedMinutes > 0
                    ? formatMinutesDuration(task.elapsedMinutes, {
                        hour: t('mobile.workerHome.durationHour'),
                        minute: t('mobile.workerHome.durationMinute'),
                      })
                    : t('mobile.production.timeTakenEmpty')}
                </AppText>
                {task.estimatedMinutes != null && task.estimatedMinutes > 0 ? (
                  <AppText variant="caption" color="muted">
                    {t('mobile.production.estimatedTime')}:{' '}
                    {formatMinutesDuration(task.estimatedMinutes, {
                      hour: t('mobile.workerHome.durationHour'),
                      minute: t('mobile.workerHome.durationMinute'),
                    })}
                  </AppText>
                ) : null}
              </View>
            </DealerBoard>
          ) : null}

            <DealerBoard title={t('mobile.production.assignedWorker')} titleWeight={titleWeight}>
              <AppText variant="caption" color="muted">
                {t('mobile.production.assignedWorker')}
              </AppText>
              {showAssign ? (
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('mobile.production.assignWorker')}
                  onPress={() => {
                    void haptics.selection();
                    setMode('workers');
                  }}
                  style={{
                    minHeight: theme.sizes.touch.min,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    paddingHorizontal: theme.spacing.md,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                  }}
                >
                  <Ionicons name="person-outline" size={18} color={colors.brand} />
                  <AppText
                    variant="label"
                    weight={titleWeight}
                    style={{ flex: 1, color: colors.textPrimary }}
                  >
                    {displayedWorkerName}
                  </AppText>
                  <Ionicons
                    name={isRTL ? 'chevron-back' : 'chevron-forward'}
                    size={18}
                    color={colors.textMuted}
                  />
                </AnimatedPressable>
              ) : (
                <View style={{ gap: 4 }}>
                  <AppText variant="label" weight={titleWeight}>
                    {task.assigneeName ?? t('mobile.production.unassigned')}
                  </AppText>
                  {!task.isCompleted ? (
                    <AppText variant="caption" color="muted">
                      {t('mobile.production.stageAssignLocked')}
                    </AppText>
                  ) : null}
                </View>
              )}

              {showAssign ? (
                <View style={{ gap: theme.spacing.xs }}>
                  <AppText variant="caption" color="muted">
                    {t('mobile.production.priorityLabel')}
                  </AppText>
                  <PriorityTouchBar value={priority} onChange={setPriority} />
                  <AppText variant="caption" color="muted" style={{ marginTop: theme.spacing.sm }}>
                    {t('mobile.production.taskWindowHint')}
                  </AppText>
                  <AppText variant="caption" weight={titleWeight} color="secondary">
                    {t('mobile.production.startDate')}
                  </AppText>
                  <InlineDateCalendar
                    value={startDate}
                    onSelect={setStartDate}
                    resetKey={`${open}-start`}
                  />
                  <HoursMinutesRow
                    sectionLabel={t('mobile.production.startTime')}
                    hours={startHour}
                    minutes={startMinute}
                    onHoursChange={setStartHour}
                    onMinutesChange={setStartMinute}
                    hoursLabel={t('mobile.production.dueHour')}
                    minutesLabel={t('mobile.production.dueMinute')}
                  />
                  <AppText variant="caption" weight={titleWeight} color="secondary">
                    {t('mobile.production.dueDate')}
                  </AppText>
                  <InlineDateCalendar value={dueDate} onSelect={setDueDate} resetKey={open} />
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
              ) : null}
            </DealerBoard>

            {showAssign && showConflictPanel ? (
              <AssignConflictBoard
                overlaps={draftWorker?.overlapWindows}
                conflicts={serverConflicts}
                reason={draftWorker?.recommendReason}
                canOverride={canOverrideConflict}
                overrideChecked={overrideConflict}
                onToggleOverride={() => setOverrideConflict((v) => !v)}
                hasSuggestedSlot={Boolean(suggested)}
                onUseSuggestedSlot={applySuggested}
              />
            ) : null}

            <DealerBoard title={t('mobile.production.workerInstructions')} titleWeight={titleWeight}>
              <AppText variant="caption" color="muted">
                {t('mobile.production.workerInstructionsHint')}
              </AppText>
              {task.canEditNotes ? (
                <TextField
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('mobile.production.workerInstructionsPlaceholder')}
                  multiline
                  numberOfLines={4}
                  style={{ minHeight: 110, textAlignVertical: 'top' }}
                />
              ) : (
                <AppText variant="body" color="secondary">
                  {notes.trim() || '—'}
                </AppText>
              )}
            </DealerBoard>

          <View style={{ gap: theme.spacing.sm }}>
            {showAssign ? (
              <PillButton
                label={
                  !selectedWorkerId
                    ? t('mobile.production.assignWorker')
                    : conflictBlocksAssign
                      ? t('mobile.production.fixWindowThenAssign')
                      : task.assigneeName && selectedWorkerId === task.assigneeId
                        ? t('mobile.production.reassignWorker')
                        : t('mobile.production.assign')
                }
                variant="primary"
                loading={assignLoading}
                disabled={Boolean(selectedWorkerId) && conflictBlocksAssign}
                icon="person-add-outline"
                onPress={() => {
                  if (!selectedWorkerId) {
                    setMode('workers');
                    return;
                  }
                  if (conflictBlocksAssign) {
                    void haptics.error();
                    return;
                  }
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
                  if (!plannedStart || !plannedCompletion) {
                    void haptics.error();
                    return;
                  }
                  void haptics.confirmMedium();
                  const eh = Number(estHours);
                  const em = Number(estMinutes);
                  const estimatedMinutes =
                    Number.isFinite(eh) || Number.isFinite(em)
                      ? hoursMinutesToTotalMinutes(
                          Number.isFinite(eh) ? eh : 0,
                          Number.isFinite(em) ? em : 0,
                        )
                      : undefined;
                  onAssign({
                    employeeId: selectedWorkerId,
                    priority,
                    plannedStart,
                    plannedCompletion,
                    ...(estimatedMinutes != null && estimatedMinutes > 0
                      ? { estimatedMinutes }
                      : {}),
                    ...(selectedIsConflict && overrideConflict
                      ? { overrideConflict: true }
                      : {}),
                  });
                }}
              />
            ) : null}

            {task.canEditNotes ? (
              <PillButton
                label={t('mobile.production.saveWorkerInstructions')}
                variant="secondary"
                loading={notesLoading}
                icon="document-text-outline"
                onPress={() => {
                  void haptics.confirmMedium();
                  onSaveNotes(notes);
                }}
              />
            ) : null}

            {canUpdateTask && task.canHold ? (
              <PillButton
                label={t('mobile.production.hold')}
                variant="secondary"
                loading={holdLoading}
                icon="pause-outline"
                onPress={() => {
                  void haptics.confirmMedium();
                  onHold();
                }}
              />
            ) : null}

            {canUpdateTask && task.canBlock ? (
              <PillButton
                label={t('mobile.production.block')}
                variant="danger"
                icon="ban-outline"
                onPress={() => setMode('block')}
              />
            ) : null}
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  );
}
