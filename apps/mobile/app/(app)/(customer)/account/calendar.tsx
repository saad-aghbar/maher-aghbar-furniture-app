import { useAuth } from '@/auth/AuthProvider';
import { DealerDeliveryCalendarScreen } from '@/features/scheduling/DealerDeliveryCalendarScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function CustomerDeliveryCalendarRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="schedule.read.own" mode="all">
      <DealerDeliveryCalendarScreen />
    </PermissionGate>
  );
}
