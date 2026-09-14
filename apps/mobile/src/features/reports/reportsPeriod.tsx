import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { reportsPeriodRange, type ReportsDateRange, type ReportsPeriod } from './selectReports';

export type CostDateBasis = 'delivered' | 'activity' | 'orderDate';

type ReportsPeriodState = {
  period: ReportsPeriod;
  customRange: ReportsDateRange | null;
  dateBasis: CostDateBasis;
  range: ReportsDateRange;
  setPeriod: (period: ReportsPeriod) => void;
  setCustomRange: (range: ReportsDateRange) => void;
  setDateBasis: (basis: CostDateBasis) => void;
};

const ReportsPeriodContext = createContext<ReportsPeriodState | null>(null);

export function ReportsPeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodState] = useState<ReportsPeriod>('month');
  const [customRange, setCustomRange] = useState<ReportsDateRange | null>(null);
  const [dateBasis, setDateBasis] = useState<CostDateBasis>('delivered');

  const range = useMemo(() => {
    if (period === 'custom' && customRange) return customRange;
    return reportsPeriodRange(period === 'custom' ? 'month' : period);
  }, [period, customRange]);

  const setPeriod = useCallback((next: ReportsPeriod) => {
    setPeriodState(next);
  }, []);

  const value = useMemo(
    () => ({
      period,
      customRange,
      dateBasis,
      range,
      setPeriod,
      setCustomRange,
      setDateBasis,
    }),
    [period, customRange, dateBasis, range, setPeriod],
  );

  return <ReportsPeriodContext.Provider value={value}>{children}</ReportsPeriodContext.Provider>;
}

export function useReportsPeriod() {
  const ctx = useContext(ReportsPeriodContext);
  if (!ctx) {
    const range = reportsPeriodRange('month');
    return {
      period: 'month' as ReportsPeriod,
      customRange: null,
      dateBasis: 'delivered' as CostDateBasis,
      range,
      setPeriod: () => undefined,
      setCustomRange: () => undefined,
      setDateBasis: () => undefined,
    };
  }
  return ctx;
}
