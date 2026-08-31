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
      title={t('mobile.production.conflictWarningTitle')}
      titleWeight={titleWeight}
      accentColor={colors.warning}
    >
      <AppText variant="body" weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {t('mobile.production.conflictChangeTimeTitle')}
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
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.brand,
            backgroundColor: colors.surface,
            paddingHorizontal: theme.spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="label" weight={titleWeight} style={{ color: colors.brand }}>
            {t('mobile.production.useFreeSlot')}
          </AppText>
        </AnimatedPressable>
      ) : null}

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
          <AppText variant="caption" style={{ flex: 1, color: colors.warning }}>
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
