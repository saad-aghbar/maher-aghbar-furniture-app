import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { WorkerOverlapWindow } from '@/api/modules/production';
import type { ScheduleConflictItem } from '../assignWindow';

type AssignConflictBoardProps = {
  overlaps?: WorkerOverlapWindow[];
  conflicts?: ScheduleConflictItem[];
  reason?: string | null;
  canOverride?: boolean;
  overrideChecked?: boolean;
  onToggleOverride?: () => void;
  onUseSuggestedSlot?: () => void;
  hasSuggestedSlot?: boolean;
  onChangeTime?: () => void;
  onChooseAnotherWorker?: () => void;
  onViewWorkerDay?: () => void;
};

export function AssignConflictBoard({
  overlaps,
  conflicts,
  reason,
  canOverride = false,
  overrideChecked = false,
  onToggleOverride,
  onUseSuggestedSlot,
  hasSuggestedSlot = false,
  onChangeTime,
  onChooseAnotherWorker,
  onViewWorkerDay,
}: AssignConflictBoardProps) {
  const { t, isRTL, locale, formatDateTime } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const lines: Array<{ label: string; when: string }> = [];
  for (const o of overlaps ?? []) {
    lines.push({
      label: o.label || t('mobile.production.conflictBusyWork'),
      when: `${formatDateTime(o.start)} → ${formatDateTime(o.end)}`,
    });
  }
  if (lines.length === 0) {
    for (const c of conflicts ?? []) {
      if (!c.start || !c.end) continue;
      lines.push({
        label: c.label || t('mobile.production.conflictBusyWork'),
        when: `${formatDateTime(c.start)} → ${formatDateTime(c.end)}`,
      });
    }
  }

  return (
    <DealerBoard
      title={t('mobile.production.workerConflictTitle')}
      titleWeight={titleWeight}
      accentColor={colors.warning}
    >
      <AppText variant="body" weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {t('mobile.production.workerConflictHeading')}
      </AppText>
      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {reason?.trim() || t('mobile.production.conflictChangeTimeBody')}
      </AppText>

      {lines.length > 0 ? (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="caption" weight={titleWeight} color="secondary">
            {t('mobile.production.conflictOverlapsHeading')}
          </AppText>
          {lines.slice(0, 4).map((line, i) => (
            <View
              key={`${line.label}-${i}`}
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                padding: theme.spacing.sm,
                gap: 2,
                overflow: 'hidden',
              }}
            >
              <AppText
                variant="caption"
                weight={titleWeight}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {line.label}
              </AppText>
              <AppText
                variant="caption"
                color="muted"
                dir="ltr"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {line.when}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {hasSuggestedSlot && onUseSuggestedSlot ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          onPress={() => {
            void haptics.confirmMedium();
            onUseSuggestedSlot();
          }}
          style={{
            minHeight: theme.sizes.touch.min,
            borderRadius: theme.radius.xl,
            borderWidth: 1.5,
            borderColor: colors.brand,
            backgroundColor: colors.surface,
            paddingHorizontal: theme.spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="label" weight={titleWeight} style={{ color: colors.brand }}>
            {t('mobile.production.suggestedWindow')}
          </AppText>
        </AnimatedPressable>
      ) : null}

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {onViewWorkerDay ? (
          <SheetChip label={t('mobile.production.viewWorkerDay')} onPress={onViewWorkerDay} />
        ) : null}
        {onChangeTime ? (
          <SheetChip label={t('mobile.production.changeTime')} onPress={onChangeTime} />
        ) : null}
        {onChooseAnotherWorker ? (
          <SheetChip
            label={t('mobile.production.chooseAnotherWorker')}
            onPress={onChooseAnotherWorker}
          />
        ) : null}
      </View>

      {canOverride && onToggleOverride ? (
        <AnimatedPressable
          variant="button"
          onPress={() => {
            void haptics.selection();
            onToggleOverride();
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: overrideChecked }}
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            minHeight: 44,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: overrideChecked ? colors.warning : colors.border,
            backgroundColor: overrideChecked ? colors.warningSoft : colors.surfaceSecondary,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 1.5,
              borderColor: colors.warning,
              backgroundColor: overrideChecked ? colors.warning : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
          <AppText
            variant="caption"
            weight={titleWeight}
            style={{
              flex: 1,
              color: colors.warning,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.production.overrideConflict')}
          </AppText>
        </AnimatedPressable>
      ) : (
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.production.conflictNoOverride')}
        </AppText>
      )}
    </DealerBoard>
  );
}

function SheetChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, theme } = useTheme();
  const { locale, isRTL } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 40,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
        paddingHorizontal: theme.spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <AppText
        variant="caption"
        weight={titleWeight}
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
