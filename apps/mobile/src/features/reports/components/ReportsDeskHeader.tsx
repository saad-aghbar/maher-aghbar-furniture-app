import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { CostDesk } from '../costFilters';
import { useReportsPeriod } from '../reportsPeriod';
import { ReportsDeskRail } from './ReportsDeskRail';
import { ReportsPeriodChrome } from './ReportsPeriodChrome';
import { ReportsRangeSheet } from './ReportsRangeSheet';

const BACK_FALLBACK = '/(app)/(admin)/(tabs)/more' as Href;

type Props = {
  desk: CostDesk;
  children?: ReactNode;
};

export function ReportsDeskHeader({ desk, children }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { period, range, dateBasis, setPeriod, setCustomRange, setDateBasis } = useReportsPeriod();
  const [rangeOpen, setRangeOpen] = useState(false);
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...(isRTL ? { right: 0 } : { left: 0 }),
              zIndex: 1,
              justifyContent: 'center',
            }}
          >
            <ScreenBackLead fallback={BACK_FALLBACK} />
          </View>
          <AppText
            variant="largeTitle"
            weight={titleWeight}
            align="center"
            numberOfLines={1}
            style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
          >
            {t('accounting.reportsTitle')}
          </AppText>
        </View>
        <AppText
          variant="caption"
          color="muted"
          align="center"
          style={{
            paddingHorizontal: theme.spacing.lg,
            letterSpacing: locale === 'ar' ? 0 : 0.2,
          }}
        >
          {t('accounting.reportsSubtitle')}
        </AppText>
      </View>

      <ReportsDeskRail active={desk} />
      <ReportsPeriodChrome
        period={period}
        from={range.from}
        to={range.to}
        dateBasis={dateBasis}
        onChange={setPeriod}
        onCustomPress={() => setRangeOpen(true)}
        onDateBasisChange={setDateBasis}
      />
      {children}
      <ReportsRangeSheet
        open={rangeOpen}
        from={range.from}
        to={range.to}
        onClose={() => setRangeOpen(false)}
        onApply={(next) => {
          setCustomRange(next);
          setPeriod('custom');
          setRangeOpen(false);
        }}
        onClear={() => {
          setPeriod('month');
          setRangeOpen(false);
        }}
      />
    </View>
  );
}
