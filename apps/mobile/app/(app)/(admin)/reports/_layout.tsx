import { Slot } from 'expo-router';
import { ReportsDeskFiltersProvider } from '@/features/reports/reportsDeskFilters';
import { ReportsPeriodProvider } from '@/features/reports/reportsPeriod';

export default function ReportsLayout() {
  return (
    <ReportsPeriodProvider>
      <ReportsDeskFiltersProvider>
        <Slot />
      </ReportsDeskFiltersProvider>
    </ReportsPeriodProvider>
  );
}
