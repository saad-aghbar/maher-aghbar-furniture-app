import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import type { FactoryDayResponse } from '@/api/modules/scheduling';
import { localizedName } from '@maher/i18n';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { minutesLabel } from '../selectFactoryTower';

type Props = {
  day: FactoryDayResponse;
  onOpenStage: (stageId: string, code: string, name: string) => void;
  onAdjustHours: () => void;
};

export function FactoryDayWorkspace({ day, onOpenStage, onAdjustHours }: Props) {
  const { t, isRTL, locale, formatDate } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const stages = day.stages ?? [];

  return (
    <View style={{ gap: theme.spacing.md }}>
      <DealerBoard
        title={t('mobile.adminScheduling.factoryDay.title')}
        trailing={
          <AppText variant="caption" color="secondary">
            {formatDate(day.date)}
          </AppText>
        }
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
          }}
        >
          <Fact
            label={t('mobile.adminScheduling.factoryDay.load')}
            value={`${day.load.factoryLoadPercent}%`}
          />
          <Fact
            label={t('mobile.adminScheduling.factoryDay.orders')}
            value={String(day.orders.length)}
          />
          <Fact
            label={t('mobile.adminScheduling.factoryDay.available')}
            value={minutesLabel(day.availableWorkerMinutes)}
          />
          <Fact
            label={t('mobile.adminScheduling.factoryDay.planned')}
            value={minutesLabel(day.plannedMinutes)}
          />
          <Fact
            label={t('mobile.adminScheduling.factoryDay.overtime')}
            value={minutesLabel(day.overtimeMinutes)}
          />
          <Fact
            label={t('mobile.adminScheduling.factoryDay.conflicts')}
            value={String(day.conflictCount)}
          />
        </View>
        {day.closed ? (
          <AppText variant="body" color="secondary" style={{ marginTop: theme.spacing.sm }}>
            {t('mobile.adminScheduling.dayClosed')}
          </AppText>
        ) : null}
        <AnimatedPressable
          variant="button"
          onPress={() => {
            void haptics.selection();
            onAdjustHours();
          }}
          style={{
            marginTop: theme.spacing.md,
            minHeight: 44,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText weight={titleWeight}>{t('mobile.adminScheduling.dayCapacity.edit')}</AppText>
        </AnimatedPressable>
      </DealerBoard>

      <DealerBoard title={t('mobile.adminScheduling.capacity.title')}>
        {stages.length === 0 ? (
          <DealerEmptyPanel nested compact text={t('mobile.adminScheduling.capacity.emptyScheduled')} />
        ) : (
          stages.map((stage, index) => {
            const booked = stage.allocatedMinutes ?? stage.bookedMinutes ?? 0;
            const available = stage.availableMinutes ?? stage.capacityMinutes ?? 0;
            const pct = available > 0 ? Math.round((booked / available) * 100) : 0;
            const name = localizedName(locale, stage, stage.code ?? '');
            return (
              <ListItemEnter key={stage.stageDefinitionId ?? stage.code} index={index}>
                <AnimatedPressable
                  variant="card"
                  onPress={() => {
                    void haptics.selection();
                    onOpenStage(
                      stage.stageDefinitionId ?? '',
                      stage.code ?? '',
                      name ?? stage.code ?? '',
                    );
                  }}
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    padding: theme.spacing.md,
                    marginBottom: theme.spacing.sm,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <AppText weight={titleWeight}>{name}</AppText>
                    <AppText variant="caption" color="secondary">
                      {t('mobile.adminScheduling.capacity.hoursOf', {
                        allocated: minutesLabel(booked),
                        available: minutesLabel(available),
                      })}
                    </AppText>
                  </View>
                  <AppText weight={titleWeight} style={{ color: colors.brand }} dir="ltr">
                    {`${pct}%`}
                  </AppText>
                </AnimatedPressable>
              </ListItemEnter>
            );
          })
        )}
        {(day.unscheduledDemand?.stages?.length ?? 0) > 0 ? (
          <View
            style={{
              marginTop: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.md,
            }}
          >
            <AppText variant="caption" color="secondary">
              {t('mobile.adminScheduling.unscheduledDemand.title')}
            </AppText>
            {day.unscheduledDemand.stages.slice(0, 4).map((row) => (
              <AppText key={row.code ?? row.nameEn ?? 'x'} variant="body">
                {t('mobile.adminScheduling.unscheduledDemand.row', {
                  stage: localizedName(locale, row, row.code ?? ''),
                  hours: minutesLabel(row.minutes),
                })}
              </AppText>
            ))}
          </View>
        ) : null}
      </DealerBoard>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        minWidth: '30%',
        flexGrow: 1,
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surfaceSecondary,
        padding: theme.spacing.sm,
      }}
    >
      <AppText variant="caption" color="secondary">
        {label}
      </AppText>
      <AppText variant="title">{value}</AppText>
    </View>
  );
}
