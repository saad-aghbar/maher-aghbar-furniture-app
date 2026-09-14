import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { ReportsFallbackScreen } from './ReportsFallbackScreen';
import { ReportsMoneyScreen } from './ReportsMoneyScreen';

export function ReportsScreen() {
  const { user } = useAuth();
  if (can(user, 'inventory.cost.read')) return <ReportsMoneyScreen />;
  return <ReportsFallbackScreen />;
}
