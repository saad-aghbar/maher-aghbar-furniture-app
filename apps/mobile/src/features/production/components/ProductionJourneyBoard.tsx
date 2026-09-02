import { View } from 'react-native';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { ProductionJourneyStage } from '../selectProductionJourney';
import { productionBoardShadow, productionInsetStyle } from '../productionFloorStyle';

type Props = {
  stages: ProductionJourneyStage[];
  onOpenStage: (stage: ProductionJourneyStage) => void;
};

function formatWhen(value: string | null, locale: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number | null, t: (k: string, p?: Record<string, number>) => string): string {
  if (minutes == null || minutes <= 0) return '—';
  if (minutes < 60) return t('mobile.production.dossier.minutesShort', { count: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0
    ? t('mobile.production.dossier.hoursMinutesShort', { hours: h, minutes: m })
    : t('mobile.production.dossier.hoursShort', { count: h });
}

/**
 * Real workflow snapshot — tap opens execution detail, not assign editor.
 */
export function ProductionJourneyBoard({ stages, onOpenStage }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (stages.length === 0) {
    return (
      <DealerBoard title={t('mobile.production.dossier.journey')} titleWeight={titleWeight}>
        <AppText variant="caption" color="muted">
          {t('mobile.production.dossier.journeyEmpty')}
        </AppText>
      </DealerBoard>
    );
  }

  return (
    <DealerBoard title={t('mobile.production.dossier.journey')} titleWeight={titleWeight}>
      <AppText variant="caption" color="muted" style={{ marginBottom: theme.spacing.sm }}>
        {t('mobile.production.dossier.journeyHint')}
      </AppText>
      <View style={{ gap: theme.spacing.sm }}>
        {stages.map((stage) => {
          const timingLabel =
            stage.timing === 'late'
              ? t('mobile.production.dossier.timingLate')
              : stage.timing === 'on_time'
                ? t('mobile.production.dossier.timingOnTime')
                : null;
          return (
            <AnimatedPressable
              key={stage.key}
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={stage.name}
              onPress={() => {
                void haptics.selection();
                onOpenStage(stage);
              }}
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: stage.hasProblem ? colors.warning : colors.borderStrong,
                backgroundColor: colors.surface,
                overflow: 'hidden',
                ...productionBoardShadow(colorScheme),
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  backgroundColor: colors.surfaceSecondary,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <StatusBadge status={stage.status} dot />
                {timingLabel ? (
                  <AppText
                    variant="caption"
                    weight={titleWeight}
                    style={{
                      color: stage.timing === 'late' ? colors.error : colors.success,
                      fontSize: 11,
                    }}
                  >
                    {timingLabel}
                  </AppText>
                ) : null}
              </View>
              <View style={{ padding: theme.spacing.md, gap: theme.spacing.xs }}>
                <AppText variant="label" weight={titleWeight} numberOfLines={1}>
                  {stage.name}
                </AppText>
                <View style={productionInsetStyle(theme, colors)}>
                  <Meta
                    label={t('mobile.production.assignedWorker')}
                    value={stage.assigneeName ?? '—'}
                    isRTL={isRTL}
                  />
                  <Meta
                    label={t('mobile.production.dossier.plannedWindow')}
                    value={`${formatWhen(stage.plannedStart, locale)} → ${formatWhen(stage.plannedEnd, locale)}`}
                    isRTL={isRTL}
                  />
                  <Meta
                    label={t('mobile.production.dossier.actualWindow')}
                    value={`${formatWhen(stage.actualStart, locale)} → ${formatWhen(stage.actualEnd, locale)}`}
                    isRTL={isRTL}
                  />
                  <Meta
                    label={t('mobile.production.dossier.duration')}
                    value={formatDuration(stage.durationMinutes, t)}
                    isRTL={isRTL}
                  />
                  {stage.hasProblem ? (
                    <Meta
                      label={t('mobile.production.dossier.problem')}
                      value={stage.problemLabel ?? t('mobile.production.dossier.problemFlag')}
                      isRTL={isRTL}
                      tone="warning"
                    />
                  ) : null}
                </View>
                <AppText variant="caption" color="brand" style={{ marginTop: 4 }}>
                  {t('mobile.production.dossier.tapExecution')}
                </AppText>
              </View>
            </AnimatedPressable>
          );
        })}
      </View>
    </DealerBoard>
  );
}

function Meta({
  label,
  value,
  isRTL,
  tone,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  tone?: 'warning';
}) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
        paddingVertical: 3,
      }}
    >
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight="medium"
        numberOfLines={2}
        style={{
          flex: 1,
          textAlign: isRTL ? 'left' : 'right',
          color: tone === 'warning' ? colors.warning : colors.textPrimary,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
