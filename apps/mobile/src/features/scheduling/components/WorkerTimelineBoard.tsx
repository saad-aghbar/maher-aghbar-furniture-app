import { useMemo } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import type { FactoryDayWorker } from '@/api/modules/scheduling';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { selectWorkerTimelineRow } from '../selectFactoryTower';

const PX_PER_HOUR = 56;

type Props = {
  workers: FactoryDayWorker[];
  timezone?: string;
  date?: string;
};

export function WorkerTimelineBoard({ workers, timezone, date }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const rows = useMemo(() => workers.map(selectWorkerTimelineRow), [workers]);
  const minStart = rows.reduce((min, row) => {
    const start = row.plan.blocks[0]?.startMs ?? min;
    return Math.min(min, start);
  }, Number.POSITIVE_INFINITY);
  const maxEnd = rows.reduce((max, row) => {
    const last = row.plan.blocks[row.plan.blocks.length - 1];
    return Math.max(max, last?.endMs ?? max);
  }, 0);
  const startMs = Number.isFinite(minStart) ? minStart : Date.now();
  const endMs = maxEnd > startMs ? maxEnd : startMs + 8 * 60 * 60 * 1000;
  const hours = Math.max(1, Math.ceil((endMs - startMs) / 3_600_000));
  const width = hours * PX_PER_HOUR;
  const now = Date.now();
  const isToday = date && new Date().toISOString().slice(0, 10) === date;
  const nowLeft = ((now - startMs) / 3_600_000) * PX_PER_HOUR;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <DealerBoard title={t('mobile.adminScheduling.timeline.title')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: width + 88 }}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', marginBottom: 8 }}>
            <View style={{ width: 88 }} />
            <View style={{ width, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              {Array.from({ length: hours + 1 }).map((_, i) => {
                const ms = startMs + i * 3_600_000;
                const label = new Intl.DateTimeFormat(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                  ...(timezone ? { timeZone: timezone } : {}),
                }).format(new Date(ms));
                return (
                  <AppText
                    key={ms}
                    variant="caption"
                    color="secondary"
                    style={{ width: PX_PER_HOUR, textAlign: 'left' }}
                  >
                    {label}
                  </AppText>
                );
              })}
            </View>
          </View>

          <FlatList
            data={rows}
            scrollEnabled={false}
            keyExtractor={(row) => row.worker.employeeId}
            renderItem={({ item: row }) => (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  marginBottom: theme.spacing.sm,
                }}
              >
                <AppText
                  numberOfLines={2}
                  weight={titleWeight}
                  style={{ width: 88, paddingRight: 8 }}
                >
                  {row.worker.name}
                </AppText>
                <View
                  style={{
                    width,
                    height: 36,
                    borderRadius: theme.radius.md,
                    backgroundColor: colors.surfaceSecondary,
                    overflow: 'hidden',
                  }}
                >
                  {row.overtimeAfterMs ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: ((row.overtimeAfterMs - startMs) / 3_600_000) * PX_PER_HOUR,
                        right: 0,
                        backgroundColor: colors.warningSoft,
                      }}
                    />
                  ) : null}
                  {row.plan.blocks
                    .filter((b) => b.kind === 'busy' || b.kind === 'stopped')
                    .map((block) => {
                      const left = ((block.startMs - startMs) / 3_600_000) * PX_PER_HOUR;
                      const blockWidth = Math.max(
                        8,
                        ((block.endMs - block.startMs) / 3_600_000) * PX_PER_HOUR,
                      );
                      const stopped = block.kind === 'stopped';
                      return (
                        <View
                          key={`${block.kind}-${block.startMs}-${block.endMs}`}
                          style={{
                            position: 'absolute',
                            left,
                            width: blockWidth,
                            top: 4,
                            bottom: 4,
                            borderRadius: 8,
                            backgroundColor: stopped ? colors.surfaceSecondary : colors.brandSoft,
                            borderWidth: 1,
                            borderColor: stopped ? colors.borderStrong : colors.brand,
                            justifyContent: 'center',
                            paddingHorizontal: 4,
                          }}
                        >
                          <AppText numberOfLines={1} variant="caption">
                            {stopped
                              ? t('mobile.adminScheduling.workerDay.stopped')
                              : block.salesOrderNumber ?? block.label}
                          </AppText>
                        </View>
                      );
                    })}
                  {isToday && nowLeft >= 0 && nowLeft <= width ? (
                    <View
                      style={{
                        position: 'absolute',
                        left: nowLeft,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        backgroundColor: colors.brand,
                      }}
                    />
                  ) : null}
                </View>
              </View>
            )}
          />
        </View>
      </ScrollView>
    </DealerBoard>
  );
}
