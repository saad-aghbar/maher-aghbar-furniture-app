import { Tabs } from 'expo-router';
import type { AppSurface } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { visibleTabsForUser, type TabName } from '@/navigation/tabConfig';
import { useTheme } from '@/theme';

type SurfaceTabsProps = {
  surface: AppSurface;
  screens: { name: TabName; labelKey: string }[];
};

export function SurfaceTabsLayout({ surface, screens }: SurfaceTabsProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const allowed = new Set(user ? visibleTabsForUser(surface, user).map((t) => t.name) : []);

  return (
    <Tabs
      // SurfaceGate mounts PersistentSurfaceTabBar so the bar survives nested pushes.
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {screens.map((s) => (
        <Tabs.Screen
          key={s.name}
          name={s.name}
          options={{
            title: s.labelKey,
            tabBarLabel: s.labelKey,
            href: allowed.has(s.name) ? undefined : null,
          }}
        />
      ))}
    </Tabs>
  );
}
