import { Tabs } from 'expo-router';
import type { AppSurface } from '@maher/permissions';
import { useStableVisibleTabs } from '@/navigation/useStableVisibleTabs';
import { type TabName } from '@/navigation/tabConfig';
import { useTheme } from '@/theme';

type SurfaceTabsProps = {
  surface: AppSurface;
  screens: { name: TabName; labelKey: string }[];
};

export function SurfaceTabsLayout({ surface, screens }: SurfaceTabsProps) {
  const { tabs } = useStableVisibleTabs(surface);
  const { colors } = useTheme();
  const allowed = new Set(tabs.map((t) => t.name));

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
