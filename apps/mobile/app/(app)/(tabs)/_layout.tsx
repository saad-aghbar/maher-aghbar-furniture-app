import { Tabs } from 'expo-router';
import { Bell, Home, LayoutGrid, Menu } from 'lucide-react-native';
import { useEffect, type ComponentType } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useAuth } from '../../../src/providers/auth-provider';
import { useI18n } from '../../../src/providers/i18n-provider';
import { can } from '../../../src/permissions/can';
import { colors, typography } from '../../../src/theme/tokens';

function TabIcon({
  Icon,
  color,
  size,
  focused,
}: {
  Icon: ComponentType<{ color?: string; size?: number }>;
  color: string;
  size: number;
  focused: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(focused ? 1.06 : 1);

  useEffect(() => {
    const target = focused ? 1.06 : 1;
    scale.value = reduceMotion
      ? target
      : withSpring(target, { damping: 26, stiffness: 260, overshootClamping: true });
  }, [focused, reduceMotion, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={style}>
      <Icon size={size} color={color} />
    </Animated.View>
  );
}

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
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Home} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="workspace"
        options={{
          title: t('common.workspace', 'Workspace'),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={LayoutGrid} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('navigation.notifications', 'Alerts'),
          href: showNotifications ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Bell} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('common.more', 'More'),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Menu} color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
