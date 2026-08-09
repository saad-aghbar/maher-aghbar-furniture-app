import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  UIManager,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { AppSurface } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics, useDraggablePillBar, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { activeTabFromPath } from './activeTabFromPath';
import { navigateToTab } from './navigateToTab';
import { visibleTabsForUser, type TabName } from './tabConfig';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  surface: AppSurface;
};

/** Outline-only so icon weight matches across the bar. */
const TAB_ICONS: Partial<Record<TabName, keyof typeof Ionicons.glyphMap>> = {
  index: 'home-outline',
  orders: 'cube-outline',
  inventory: 'layers-outline',
  production: 'construct-outline',
  more: 'ellipsis-horizontal-outline',
  tasks: 'checkbox-outline',
  completed: 'checkmark-done-outline',
  profile: 'person-outline',
  account: 'person-circle-outline',
  catalog: 'grid-outline',
  'new-order': 'add-circle-outline',
  notifications: 'notifications-outline',
};

const SHELL_PAD = 6;
const INACTIVE_SLOT = 44;
const ACTIVE_HEIGHT = 46;
/** Soft glide — low stiffness, a touch of mass so the bubble eases rather than snaps. */
const PILL_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;

type TabInk = 'brand' | 'onBrand';

function TabItemContent({
  iconName,
  label,
  expanded,
  ink,
  isRTL,
  brand,
  onBrand,
  iconSize = 22,
  slotHeight = ACTIVE_HEIGHT,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  expanded: boolean;
  ink: TabInk;
  isRTL: boolean;
  brand: string;
  onBrand: string;
  iconSize?: number;
  slotHeight?: number;
}) {
  const color = ink === 'onBrand' ? onBrand : brand;
  return (
    <View
      style={{
        height: slotHeight,
        paddingHorizontal: expanded ? 14 : 0,
        width: expanded ? undefined : INACTIVE_SLOT,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: expanded ? 8 : 0,
      }}
    >
      <Ionicons name={iconName} size={iconSize} color={color} />
      {/* Keep mounted — clip width so fast scrubs don't opacity-fade */}
      <View
        style={{
          overflow: 'hidden',
          maxWidth: expanded ? 120 : 0,
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          numberOfLines={1}
          style={{
            color,
            fontSize: 13,
            lineHeight: 16,
          }}
        >
          {label}
        </AppText>
      </View>
    </View>
  );
}

/**
 * Surface-level tab bar — stays mounted when Stack pushes products / details / etc.
 * Floating admin/worker bar: press-and-hold then drag; hovered tab reveals its label.
 * On-brand ink is clipped to the sliding pill so contrast stays correct mid-slide.
 */
export function PersistentSurfaceTabBar({ surface }: Props) {
  const { user } = useAuth();
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, t } = useLocale();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const [trackWidth, setTrackWidth] = useState(0);
  /** While scrubbing, which tab shows its label (null = route active). */
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const tabs = useMemo(
    () => (user ? visibleTabsForUser(surface, user) : []),
    [surface, user],
  );
  const activeName = activeTabFromPath(surface, pathname);
  const activeLayout = layouts[activeName];
  /** Admin + worker get the floating icon pill; dealer stays docked text. */
  const floating = surface === 'admin' || surface === 'employee';
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.name === activeName),
  );
  /** While scrubbing, expand the hovered tab so the bubble + label track the finger. */
  const expandedIndex = scrubIndex ?? activeIndex;

  const orderedLayouts = useMemo(
    () => tabs.map((tab) => layouts[tab.name]),
    [layouts, tabs],
  );

  const go = useCallback(
    (name: TabName) => {
      void haptics.selection();
      navigateToTab(router, surface, name, pathname);
    },
    [pathname, router, surface],
  );

  const onSelectIndex = useCallback(
    (index: number) => {
      const tab = tabs[index];
      if (!tab) return;
      navigateToTab(router, surface, tab.name, pathname);
    },
    [pathname, router, surface, tabs],
  );

  const onScrubIndexChange = useCallback(
    (index: number | null) => {
      if (!reduce) {
        LayoutAnimation.configureNext({
          duration: 280,
          update: {
            type: LayoutAnimation.Types.easeInEaseOut,
          },
        });
      }
      setScrubIndex(index);
    },
    [reduce],
  );

  const { pillX, pillW, dragging, gesture } = useDraggablePillBar({
    layouts: orderedLayouts,
    activeIndex,
    onSelectIndex,
    onScrubIndexChange,
    reduceMotion: reduce,
    enabled: floating && tabs.length > 0,
    spring: PILL_SPRING,
  });

  const onLayoutTab = useCallback((name: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[name];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [name]: { x, width } };
    });
  }, []);

  useEffect(() => {
    if (floating && !reduce) return;
    if (!activeLayout || activeLayout.width <= 0) return;
    pillX.value = activeLayout.x;
    pillW.value = activeLayout.width;
  }, [activeLayout, floating, pillW, pillX, reduce]);

  useEffect(() => {
    setScrubIndex(null);
  }, [activeName]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
  }));

  const pillFillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + dragging.value * 0.02 }],
  }));

  const pillInkStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pillX.value }],
  }));

  if (tabs.length === 0) return null;

  if (floating) {
    const shellBg =
      colorScheme === 'dark' ? 'rgba(42,36,37,0.94)' : 'rgba(255,255,255,0.96)';

    const rowStyle = {
      flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      height: ACTIVE_HEIGHT,
      width: trackWidth > 0 ? trackWidth : ('100%' as const),
    };

    return (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: theme.spacing.md,
          right: theme.spacing.md,
          bottom: Math.max(insets.bottom, theme.spacing.sm),
          zIndex: 50,
        }}
      >
        <View
          style={{
            height: SHELL_PAD * 2 + ACTIVE_HEIGHT,
            borderRadius: (SHELL_PAD * 2 + ACTIVE_HEIGHT) / 2,
            backgroundColor: shellBg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: SHELL_PAD,
            ...theme.elevation.raised,
          }}
        >
          <GestureDetector gesture={gesture}>
            <View
              style={{
                flex: 1,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                overflow: 'hidden',
                borderRadius: ACTIVE_HEIGHT / 2,
              }}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0 && w !== trackWidth) setTrackWidth(w);
              }}
            >
              {tabs.map((tab, index) => {
                const expanded = index === expandedIndex;
                const label = t(`mobile.tabs.${tab.labelKey}`);
                const iconName = TAB_ICONS[tab.name] ?? 'ellipse-outline';
                return (
                  <Pressable
                    key={tab.name}
                    accessibilityRole="button"
                    accessibilityState={{ selected: tab.name === activeName }}
                    accessibilityLabel={label}
                    onLayout={(e) => onLayoutTab(tab.name, e)}
                    onPress={() => go(tab.name)}
                    style={{ zIndex: 1 }}
                  >
                    <TabItemContent
                      iconName={iconName}
                      label={label}
                      expanded={expanded}
                      ink="brand"
                      isRTL={isRTL}
                      brand={colors.brand}
                      onBrand={colors.onBrand}
                    />
                  </Pressable>
                );
              })}

              {orderedLayouts.some((l) => l && l.width > 0) && trackWidth > 0 ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      borderRadius: ACTIVE_HEIGHT / 2,
                      overflow: 'hidden',
                      zIndex: 2,
                    },
                    pillStyle,
                  ]}
                >
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        borderRadius: ACTIVE_HEIGHT / 2,
                        backgroundColor: colors.brand,
                      },
                      pillFillStyle,
                    ]}
                  />
                  <Animated.View style={[rowStyle, pillInkStyle]}>
                    {tabs.map((tab, index) => {
                      const expanded = index === expandedIndex;
                      const label = t(`mobile.tabs.${tab.labelKey}`);
                      const iconName = TAB_ICONS[tab.name] ?? 'ellipse-outline';
                      return (
                        <TabItemContent
                          key={`ink-${tab.name}`}
                          iconName={iconName}
                          label={label}
                          expanded={expanded}
                          ink="onBrand"
                          isRTL={isRTL}
                          brand={colors.brand}
                          onBrand={colors.onBrand}
                        />
                      );
                    })}
                  </Animated.View>
                </Animated.View>
              ) : null}
            </View>
          </GestureDetector>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
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
        }}
      >
        {tabs.map((tab) => {
          const focused = tab.name === activeName;
          const label = t(`mobile.tabs.${tab.labelKey}`);
          return (
            <Pressable
              key={tab.name}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => go(tab.name)}
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
