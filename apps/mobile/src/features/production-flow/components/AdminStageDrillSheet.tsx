import { type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { ProgressBar } from '@/motion';
import { useTheme } from '@/theme';
import {
  formatElapsedClock,
  formatMinutesDuration,
  minutesBetween,
} from '@/features/tasks/formatDuration';
import { useLiveTaskTimer } from '@/features/tasks/useLiveTaskTimer';
import {
  nextStageAfter,
  type ProductionFlowModel,
  type ProductionFlowStage,
} from '../selectProductionFlow';
import { isStageStatusComplete, StageWorkPhotos } from './StageWorkPhotos';

type Props = {
  open: boolean;
  onClose: () => void;
  stage: ProductionFlowStage | null;
  flow: ProductionFlowModel;
};

type Assignee = ProductionFlowStage['assignees'][number];

function SectionCard({
  icon,
  label,
  children,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: ReactNode;
  accent?: string;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
        overflow: 'hidden',
      }}
    >
      {accent ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: 0.85,
          }}
        />
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: accent ? 4 : 0 }
            : { paddingLeft: accent ? 4 : 0 }),
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name={icon} size={16} color={accent ?? colors.brand} />
        </View>
        <AppText variant="caption" color="muted" style={{ flex: 1 }}>
          {label}
        </AppText>
      </View>
      <View
        style={{
          ...(isRTL
            ? { paddingRight: accent ? 4 : 0 }
            : { paddingLeft: accent ? 4 : 0 }),
        }}
      >
        {children}
      </View>
    </View>
  );
}

function StageAssigneeRow({
  assignee,
  titleWeight,
}: {
  assignee: Assignee;
  titleWeight: 'medium' | 'semibold';
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const running = Boolean(assignee.running);
  const closedMinutes = Math.max(0, Math.round(assignee.actualMinutes ?? 0));
  const closedSeconds =
    typeof assignee.actualSeconds === 'number'
      ? Math.max(0, Math.floor(assignee.actualSeconds))
      : closedMinutes * 60;
  const { elapsedSeconds, elapsedMinutes } = useLiveTaskTimer(
    assignee.openStartedAt,
    closedSeconds,
    running,
  );
  const hm = {
    hour: t('mobile.workerHome.durationHour'),
    minute: t('mobile.workerHome.durationMinute'),
  };
  const staticMinutes = Math.max(
    0,
    Math.round(assignee.elapsedMinutes ?? assignee.actualMinutes ?? 0),
  );
  const displayMinutes = running ? elapsedMinutes : staticMinutes;

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: theme.spacing.md,
        gap: theme.spacing.xs,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <AppText variant="body" weight={titleWeight} style={{ flex: 1 }}>
          {assignee.name}
        </AppText>
        {running ? (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: theme.radius.full,
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.brand,
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              style={{ color: colors.brand, fontSize: 10 }}
            >
              {t('mobile.tasks.timerLive')}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="caption" color="muted">
        {running
          ? t('mobile.productionFlow.timeRunning')
          : t('mobile.productionFlow.timeTaken')}
      </AppText>
      {running ? (
        <AppText variant="heading" weight="semibold" dir="ltr">
          {formatElapsedClock(elapsedSeconds)}
        </AppText>
      ) : (
        <AppText variant="label" weight={titleWeight}>
          {displayMinutes > 0
            ? formatMinutesDuration(displayMinutes, hm)
            : t('mobile.productionFlow.timeTakenEmpty')}
        </AppText>
      )}
    </View>
  );
}

function StageLifetimeBlock({
  stage,
  completed,
}: {
  stage: ProductionFlowStage;
  completed: boolean;
}) {
  const { t } = useLocale();
  const inProgress = stage.status === 'IN_PROGRESS' || stage.status === 'PAUSED';
  const live = inProgress && Boolean(stage.actualStart) && !stage.actualEnd;
  const { elapsedSeconds, elapsedMinutes } = useLiveTaskTimer(
    live ? stage.actualStart : null,
    0,
    live,
  );
  const hm = {
    hour: t('mobile.workerHome.durationHour'),
    minute: t('mobile.workerHome.durationMinute'),
  };

  if (live) {
    return (
      <View style={{ gap: 4 }}>
        <AppText variant="caption" color="muted">
          {t('mobile.productionFlow.stageLifetime')}
        </AppText>
        <AppText variant="label" weight="semibold" dir="ltr">
          {formatElapsedClock(elapsedSeconds)}
        </AppText>
        <AppText variant="caption" color="secondary">
          {formatMinutesDuration(elapsedMinutes, hm)}
        </AppText>
      </View>
    );
  }

  if (completed && stage.actualStart && stage.actualEnd) {
    const mins = minutesBetween(stage.actualStart, stage.actualEnd);
    if (mins <= 0) return null;
    return (
      <View style={{ gap: 4 }}>
        <AppText variant="caption" color="muted">
          {t('mobile.productionFlow.stageLifetime')}
        </AppText>
        <AppText variant="label" weight="semibold">
          {formatMinutesDuration(mins, hm)}
        </AppText>
      </View>
    );
  }

  return null;
}

/**
 * Admin stage drill-in — production floor aesthetic (soft cards, progress, badges).
 */
export function AdminStageDrillSheet({ open, onClose, stage, flow }: Props) {
  const { t, formatDate, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const upNext = stage ? nextStageAfter(flow.stages, stage.code) : null;
  const completed = stage ? isStageStatusComplete(stage.status) : false;
  const pct = stage
    ? Math.max(0, Math.min(100, Math.round(stage.progressPercent || 0)))
    : 0;
  const overdue = Boolean(stage?.isOverdue);
  const blocked =
    stage?.status === 'BLOCKED' || (stage?.blockers.length ?? 0) > 0;
  const accent = blocked
    ? colors.error
    : overdue
      ? colors.error
      : stage?.status === 'IN_PROGRESS'
        ? colors.brand
        : completed
          ? colors.success
          : colors.borderStrong;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const bottomPad = insets.bottom + theme.spacing.md;

  const dateLines = stage
    ? [
        stage.actualStart
          ? `${t('mobile.productionFlow.started')}: ${formatDate(stage.actualStart)}`
          : null,
        stage.actualEnd
          ? `${t('mobile.productionFlow.ended')}: ${formatDate(stage.actualEnd)}`
          : null,
        stage.plannedEnd
          ? `${t('mobile.productionFlow.plannedEnd')}: ${formatDate(stage.plannedEnd)}`
          : null,
      ].filter(Boolean)
    : [];

  return (
    <BottomSheet
      open={open && Boolean(stage)}
      onClose={onClose}
      title={stage?.name ?? t('mobile.productionFlow.stageDetails')}
      fitContent
    >
      {stage ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: bottomPad,
          }}
        >
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: overdue || blocked ? colors.error : colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                ...(isRTL ? { right: 0 } : { left: 0 }),
                width: 3,
                backgroundColor: accent,
                opacity: overdue || blocked ? 1 : 0.55,
              }}
            />
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.spacing.sm,
                ...(isRTL ? { paddingRight: 4 } : { paddingLeft: 4 }),
              }}
            >
              <StatusBadge status={stage.status} dot />
              {overdue ? (
                <StatusBadge
                  status="OVERDUE"
                  label={t('mobile.productionFlow.overdue')}
                  dot
                />
              ) : null}
            </View>
            <View
              style={{
                gap: theme.spacing.xs,
                ...(isRTL ? { paddingRight: 4 } : { paddingLeft: 4 }),
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <AppText variant="caption" color="secondary">
                  {t('mobile.production.progress')}
                </AppText>
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: accent }}
                  dir="ltr"
                >
                  {`${pct}%`}
                </AppText>
              </View>
              <ProgressBar
                progress={pct / 100}
                height={5}
                fillStyle={{ backgroundColor: accent }}
                trackStyle={{ backgroundColor: colors.surface }}
              />
            </View>
          </View>

          <SectionCard
            icon="images-outline"
            label={t('mobile.productionFlow.workPhotos')}
          >
            <StageWorkPhotos
              photos={stage.photos}
              stageCompleted={completed}
              hideTitle
            />
          </SectionCard>

          <SectionCard
            icon="people-outline"
            label={t('mobile.productionFlow.workers')}
            accent={stage.assignees.length ? colors.brand : undefined}
          >
            {stage.assignees.length ? (
              <View style={{ gap: theme.spacing.sm }}>
                {stage.assignees.map((a) => (
                  <StageAssigneeRow
                    key={a.id}
                    assignee={a}
                    titleWeight={titleWeight}
                  />
                ))}
              </View>
            ) : (
              <AppText variant="body" weight={titleWeight}>
                {t('mobile.productionFlow.unassigned')}
              </AppText>
            )}
          </SectionCard>

          <SectionCard icon="calendar-outline" label={t('mobile.productionFlow.dates')}>
            <View style={{ gap: theme.spacing.sm }}>
              <StageLifetimeBlock stage={stage} completed={completed} />
              {dateLines.length ? (
                <View style={{ gap: theme.spacing.xs }}>
                  {dateLines.map((line) => (
                    <AppText key={line} variant="body">
                      {line}
                    </AppText>
                  ))}
                </View>
              ) : !stage.actualStart ? (
                <AppText variant="body" color="secondary">
                  {t('mobile.productionFlow.noDates')}
                </AppText>
              ) : null}
            </View>
          </SectionCard>

          {stage.blockers.length ? (
            <SectionCard
              icon="alert-circle-outline"
              label={t('mobile.productionFlow.blockers')}
              accent={colors.error}
            >
              <View style={{ gap: theme.spacing.sm }}>
                {stage.blockers.map((b) => (
                  <AppText key={b.id} variant="body" color="secondary">
                    {b.category}: {b.reason}
                  </AppText>
                ))}
              </View>
            </SectionCard>
          ) : null}

          <SectionCard
            icon="document-text-outline"
            label={t('mobile.productionFlow.notes')}
          >
            <AppText
              variant="body"
              color={stage.notes?.trim() ? undefined : 'muted'}
            >
              {stage.notes?.trim() || t('mobile.productionFlow.notesEmpty')}
            </AppText>
          </SectionCard>

          {upNext ? (
            <SectionCard
              icon="arrow-forward-outline"
              label={t('mobile.productionFlow.upNext')}
              accent={colors.brand}
            >
              <AppText variant="body" weight={titleWeight}>
                {upNext.name}
              </AppText>
            </SectionCard>
          ) : null}
        </ScrollView>
      ) : null}
    </BottomSheet>
  );
}
