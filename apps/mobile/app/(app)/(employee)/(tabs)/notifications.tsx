import { useAuth } from '@/auth/AuthProvider';
import { NotificationsInboxScreen } from '@/features/notifications/NotificationsInboxScreen';
import { PermissionGate } from '@/navigation/PermissionGate';

export default function EmployeeNotifications() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="notification.read" mode="all">
      <NotificationsInboxScreen embeddedInTabs />
    </PermissionGate>
  );
}
