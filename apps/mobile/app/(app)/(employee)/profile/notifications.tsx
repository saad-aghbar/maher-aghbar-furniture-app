import type { Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { PermissionGate } from '@/navigation/PermissionGate';
import { NotificationSettingsScreen } from '@/features/notifications/NotificationSettingsScreen';

export default function EmployeeNotificationSettingsRoute() {
  const { user } = useAuth();
  return (
    <PermissionGate user={user} require="notification.read" mode="all">
      <NotificationSettingsScreen backFallback={'/(app)/(employee)/(tabs)/profile' as Href} />
    </PermissionGate>
  );
}
