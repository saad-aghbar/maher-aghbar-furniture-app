import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { AppSurface } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { TabIndicator, haptics, useReducedMotion } from '@/motion';
import { springs } from '@/motion/presets';
import { useTheme } from '@/theme';
import { visibleTabsForUser, type TabName } from './tabConfig';

type SurfaceTabBarProps = BottomTabBarProps & {
  surface: AppSurface;
};

const TAB_ICONS: Partial<Record<TabName, keyof typeof Ionicons.glyphMap>> = {
  index: 'home',
  orders: 'cube-outline',
  inventory: 'layers-outline',
  production: 'construct-outline',
  more: 'ellipsis-horizontal',
  tasks: 'checkbox-outline',
  completed: 'checkmark-done-outline',
  profile: 'person-outline',
  account: 'person-circle-outline',
  catalog: 'grid-outline',
  'new-order': 'add-circle-outline',
  notifications: 'notifications-outline',
};

/**
 * Custom tab bar: max 5 permission-filtered tabs, haptic, RTL, safe area.
 * Admin surface uses floating glass pill with icon+label on the active tab.
 */
export function SurfaceTabBar({ state, descriptors, navigation, surface }: SurfaceTabBarProps) {
  const { user } = useAuth();
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, t } = useLocale();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);

  const allowed = user ? visibleTabsForUser(surface, user).map((tab) => tab.name) : [];
  const visibleRoutes = state.routes.filter((r) => allowed.includes(r.name as TabName));
  const floating = surface === 'admin';

  const activeRoute = state.routes[state.index];
  const activeName = activeRoute?.name;
  const activeLayout = activeName ? layouts[activeName] : undefined;

  const onLayoutTab = useCallback(
    (name: string, e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      setLayouts((prev) => {
        const cur = prev[name];
        if (cur && cur.x === x && cur.width === width) return prev;
        return { ...prev, [name]: { x, width } };
      });
    },
    [],
  );

  useEffect(() => {
    if (!activeName || !layouts[activeName]) return;
    const { x, width } = layouts[activeName]!;
    if (reduce) {
      pillX.value = x;
      pillW.value = width;
    } else {
      pillX.value = withSpring(x, springs.snappy);
      pillW.value = withSpring(width, springs.snappy);
    }
  }, [activeName, layouts, pillW, pillX, reduce]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
  }));

  if (floating) {
    return (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: theme.spacing.lg,
          right: theme.spacing.lg,
          bottom: Math.max(insets.bottom, theme.spacing.sm),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            minHeight: 64,
            borderRadius: 32,
            backgroundColor:
              colorScheme === 'dark' ? 'rgba(42,36,37,0.92)' : 'rgba(255,255,255,0.92)',
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: theme.spacing.xs,
            paddingVertical: theme.spacing.xs,
            alignItems: 'center',
            ...theme.elevation.raised,
            overflow: 'hidden',
          }}
        >
          {activeLayout && activeLayout.width > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: theme.spacing.xs,
                  bottom: theme.spacing.xs,
                  left: 0,
                  borderRadius: 28,
                  backgroundColor: colors.brand,
                },
                pillStyle,
              ]}
            />
          ) : null}
          {visibleRoutes.map((route) => {
            const focused = state.index === state.routes.indexOf(route);
            const { options } = descriptors[route.key]!;
            const labelKey =
              (options.tabBarLabel as string | undefined) ??
              (options.title as string | undefined) ??
              route.name;
            const label = t(`mobile.tabs.${labelKey}`);
            const iconName = TAB_ICONS[route.name as TabName] ?? 'ellipse-outline';

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                onLayout={(e) => onLayoutTab(route.name, e)}
                onPress={() => {
                  void haptics.selection();
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                style={{
                  flex: focused ? 1.35 : 1,
                  minHeight: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: 6,
                  paddingHorizontal: theme.spacing.sm,
                  zIndex: 2,
                }}
              >
                <Ionicons
                  name={iconName}
                  size={20}
                  color={focused ? colors.onBrand : colors.textSecondary}
                />
                {focused ? (
                  <AppText
                    variant="caption"
                    weight="semibold"
                    numberOfLines={1}
                    style={{ color: colors.onBrand }}
                  >
                    {label}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
        paddingBottom: Math.max(insets.bottom, theme.spacing.sm),
        paddingTop: theme.spacing.xs,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          minHeight: theme.sizes.touch.min,
          position: 'relative',
        }}
      >
        {activeLayout && activeLayout.width > 0 ? (
          <TabIndicator
            left={activeLayout.x + 8}
            width={Math.max(activeLayout.width - 16, 24)}
            style={{ position: 'absolute', bottom: 0, zIndex: 1 }}
          />
        ) : null}
        {visibleRoutes.map((route) => {
          const focused = state.index === state.routes.indexOf(route);
          const { options } = descriptors[route.key]!;
          const labelKey =
            (options.tabBarLabel as string | undefined) ??
            (options.title as string | undefined) ??
            route.name;
          const label = t(`mobile.tabs.${labelKey}`);

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onLayout={(e) => onLayoutTab(route.name, e)}
              onPress={() => {
                void haptics.selection();
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={{
                flex: 1,
                minHeight: theme.sizes.touch.min,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: theme.spacing.xs,
                paddingBottom: theme.spacing.sm,
              }}
            >
              <AppText
                variant="caption"
                weight={focused ? 'semibold' : 'medium'}
                color={focused ? 'brand' : 'secondary'}
                align="center"
                numberOfLines={1}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
