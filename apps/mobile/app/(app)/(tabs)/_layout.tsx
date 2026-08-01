import { Tabs } from 'expo-router';
import { Bell, Home, LayoutGrid, Menu } from 'lucide-react-native';
import { useAuth } from '../../../src/providers/auth-provider';
import { useI18n } from '../../../src/providers/i18n-provider';
import { can } from '../../../src/permissions/can';
import { colors, typography } from '../../../src/theme/tokens';

export default function TabsLayout() {
  const { user } = useAuth();
  const { t } = useI18n();
  const showNotifications = can(user, 'notification.read');

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { ...typography.heading, color: colors.textPrimary },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('navigation.dashboard', 'Home'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="workspace"
        options={{
          title: t('common.workspace', 'Workspace'),
          tabBarIcon: ({ color, size }) => <LayoutGrid size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('navigation.notifications', 'Alerts'),
          href: showNotifications ? undefined : null,
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('common.actions', 'More'),
          tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
