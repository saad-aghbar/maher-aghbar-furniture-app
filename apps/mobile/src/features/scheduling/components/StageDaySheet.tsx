import { ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { AdaptiveOverlay } from '@/adaptive/AdaptiveOverlay';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import type { FactoryDayResponse, FactoryDayWorker } from '@/api/modules/scheduling';
import { localeRow, useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { minutesLabel } from '../selectFactoryTower';
import { WorkerTimelineBoard } from './WorkerTimelineBoard';

type Props = {
  open: boolean;
  onClose: () => void;
  date: string;
  stageName: string;
  day: FactoryDayResponse | undefined;
  workers: FactoryDayWorker[];
  scheduledMinutes: number;
  availableMinutes: number;
  onOpenWorker: (worker: FactoryDayWorker) => void;
};

export function StageDaySheet({
  open,
  onClose,
  date,
  stageName,
  day,
  workers,
  scheduledMinutes,
  availableMinutes,
  onOpenWorker,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const free = Math.max(0, availableMinutes - scheduledMinutes);

  return (
    <AdaptiveOverlay
      open={open}
      onClose={onClose}
      title={`${stageName} · ${date}`}
      intent="inspector"
      expandable
    >
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing['3xl'] }}>
        <DealerBoard>
          <AppText weight={titleWeight}>
            {t('mobile.adminScheduling.stageDay.hours', {
              scheduled: minutesLabel(scheduledMinutes),
              available: minutesLabel(availableMinutes),
            })}
          </AppText>
          <AppText variant="body" color="secondary">
            {t('mobile.adminScheduling.stageDay.meta', {
              workers: workers.length,
              free: minutesLabel(free),
              conflicts: day?.conflictCount ?? 0,
            })}
          </AppText>
        </DealerBoard>

        {workers.map((worker, index) => (
          <ListItemEnter key={worker.employeeId} index={index}>
            <AnimatedPressable
              variant="card"
              onPress={() => {
                void haptics.selection();
                onOpenWorker(worker);
              }}
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                padding: theme.spacing.md,
              }}
            >
              <View style={{ flexDirection: localeRow(isRTL), justifyContent: 'space-between' }}>
                <AppText weight={titleWeight}>{worker.name}</AppText>
                <AppText color="secondary" dir="ltr">
                  {`${minutesLabel(worker.scheduledMinutes)} / ${minutesLabel(worker.availableMinutes)}`}
                </AppText>
              </View>
              {worker.overtime ? (
                <AppText variant="caption" style={{ color: colors.warning }}>
                  {t('mobile.adminScheduling.overtimeBadge')}
                </AppText>
              ) : null}
            </AnimatedPressable>
          </ListItemEnter>
        ))}

        <WorkerTimelineBoard workers={workers} timezone={day?.timezone} date={date} />
      </ScrollView>
    </AdaptiveOverlay>
  );
}
