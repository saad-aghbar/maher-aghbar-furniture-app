import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { ReportsFallbackScreen } from './ReportsFallbackScreen';
import { ReportsMoneyDeskHost } from './ReportsDeskHost';

export function ReportsScreen() {
  const { user } = useAuth();
  if (can(user, 'inventory.cost.read')) return <ReportsMoneyDeskHost />;
  return <ReportsFallbackScreen />;
}
