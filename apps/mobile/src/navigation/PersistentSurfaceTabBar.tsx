import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  UIManager,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { AppSurface } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { DealerNewOrderButton, DEALER_FAB_SIZE } from '@/features/dealer-ui/DealerNewOrderButton';
import { useLocale } from '@/i18n';
import { haptics, useDraggablePillBar, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { can } from '@maher/permissions';
import { activeTabFromPath } from './activeTabFromPath';
import { navigateToTab } from './navigateToTab';
import { type TabName } from './tabConfig';
import { useStableVisibleTabs } from './useStableVisibleTabs';
import {
  STAFF_CAPSULE_MIN,
  STAFF_PILL_DURATION_MS,
  shouldUseStaffAdaptiveTabLayout,
  staffCapsuleInSlot,
  staffFallbackTabName,
} from './staffAdaptiveTabLayout';

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
  schedule: 'calendar-outline',
  'new-order': 'add-circle-outline',
  notifications: 'notifications-outline',
};

const SHELL_PAD = 6;
const INACTIVE_SLOT = 44;
const ACTIVE_HEIGHT = 46;
/** Soft glide for admin label-expand pill. */
const PILL_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;
/**
 * Apple-like liquid bubble — slightly underdamped so it eases + settles
 * (closer to iOS tab / segmented control feel).
 */
const APPLE_BUBBLE_SPRING = { damping: 24, stiffness: 170, mass: 0.92 } as const;

function TabItemContent({
  iconName,
  label,
  expanded,
  isRTL,
  color,
  iconSize = 22,
  slotHeight = ACTIVE_HEIGHT,
  iconsOnly = false,
  hugContent = false,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  expanded: boolean;
  isRTL: boolean;
  color: string;
  iconSize?: number;
  slotHeight?: number;
  /** Dealer bar: icons only, no expanding labels. */
  iconsOnly?: boolean;
  /** Staff: size to icon/label so the capsule can hug content inside a flex slot. */
  hugContent?: boolean;
}) {
  const showLabel = !iconsOnly && expanded;
  return (
    <View
      style={{
        height: slotHeight,
        paddingHorizontal: showLabel ? 14 : 0,
        width: hugContent
          ? undefined
          : showLabel
            ? undefined
            : iconsOnly
              ? slotHeight
              : INACTIVE_SLOT,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: showLabel ? 8 : 0,
      }}
    >
      <Ionicons name={iconName} size={iconSize} color={color} />
      {!iconsOnly ? (
        <View
          style={{
            overflow: 'hidden',
            maxWidth: showLabel ? 120 : 0,
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
      ) : null}
    </View>
  );
}

/**
 * Surface-level tab bar — stays mounted when Stack pushes products / details / etc.
 * Floating admin/worker bar: press-and-hold then drag; hovered tab reveals its label.
 * Frosted glass shell + cream bubble (dealer material) on every floating surface.
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
  const [contentWidths, setContentWidths] = useState<Record<string, number>>({});
  /** While scrubbing, which tab shows its label (null = route active). */
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const { tabs, layoutKey: tabNamesKey } = useStableVisibleTabs(surface);
  const activeName = activeTabFromPath(surface, pathname);
  /** Floating icon pill for admin, worker, and dealer. */
  const floating = surface === 'admin' || surface === 'employee' || surface === 'customer';
  const dealerFab =
    surface === 'customer' && Boolean(user && can(user, 'request.create'));
  /** Dealer: icon-only equal pills — no expanding labels. */
  const iconsOnly = surface === 'customer';
  const staffAdaptive = shouldUseStaffAdaptiveTabLayout(surface, user);
  const tabInBar = tabs.some((tab) => tab.name === activeName);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.name === activeName),
  );
  /** While scrubbing, expand the hovered tab so the bubble + label track the finger. */
  const expandedIndex = iconsOnly ? -1 : scrubIndex ?? (tabInBar ? activeIndex : -1);

  const orderedLayouts = useMemo(() => {
    return tabs.map((tab) => {
      const layout = layouts[tab.name];
      if (!layout || layout.width <= 0) return undefined;
      if (staffAdaptive) {
        return staffCapsuleInSlot(layout, contentWidths[tab.name] ?? STAFF_CAPSULE_MIN);
      }
      if (!iconsOnly) return layout;
      // Equal pill centered in each flex slot.
      const pill = ACTIVE_HEIGHT;
      return {
        x: layout.x + Math.max(0, (layout.width - pill) / 2),
        width: pill,
      };
    });
  }, [contentWidths, iconsOnly, layouts, staffAdaptive, tabs]);
  const activeLayout = tabInBar ? orderedLayouts[activeIndex] : undefined;
  const layoutsReady =
    tabs.length > 0 && orderedLayouts.every((l) => l != null && l.width > 0);

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
      if (iconsOnly) {
        setScrubIndex(null);
        return;
      }
      if (!reduce && !staffAdaptive) {
        LayoutAnimation.configureNext({
          duration: 280,
          update: {
            type: LayoutAnimation.Types.easeInEaseOut,
          },
        });
      }
      setScrubIndex(index);
    },
    [iconsOnly, reduce, staffAdaptive],
  );

  const bubbleSpring = iconsOnly ? APPLE_BUBBLE_SPRING : PILL_SPRING;
  const staffTiming = staffAdaptive
    ? { duration: STAFF_PILL_DURATION_MS }
    : undefined;

  const { pillX, pillW, dragging, gesture } = useDraggablePillBar({
    layouts: orderedLayouts,
    activeIndex: tabInBar ? activeIndex : 0,
    onSelectIndex,
    onScrubIndexChange,
    reduceMotion: reduce,
    enabled: floating && tabs.length > 0 && tabInBar,
    spring: bubbleSpring,
    timing: staffTiming,
  });

  const onLayoutTab = useCallback((name: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[name];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [name]: { x, width } };
    });
  }, []);

  const onContentLayout = useCallback((name: string, width: number) => {
    setContentWidths((prev) => {
      if (prev[name] === width) return prev;
      return { ...prev, [name]: width };
    });
  }, []);

  useEffect(() => {
    setScrubIndex(null);
  }, [activeName]);

  useEffect(() => {
    // Remeasure only when the chip set actually changes (not on AuthUser identity churn).
    setLayouts({});
    setContentWidths({});
  }, [tabNamesKey, dealerFab]);

  useEffect(() => {
    if (!staffAdaptive || tabs.length === 0) return;
    const next = staffFallbackTabName(tabs, activeName);
    if (next === activeName) return;
    navigateToTab(router, surface, next, pathname);
  }, [activeName, pathname, router, staffAdaptive, surface, tabs]);

  // Spring the bubble to the active slot (instant assign killed Apple-like motion).
  useEffect(() => {
    if (!activeLayout || activeLayout.width <= 0) return;
    if (dragging.value) return;
    if (reduce) {
      pillX.value = activeLayout.x;
      pillW.value = activeLayout.width;
      return;
    }
    if (staffAdaptive) {
      const cfg = {
        duration: STAFF_PILL_DURATION_MS,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      };
      pillX.value = withTiming(activeLayout.x, cfg);
      pillW.value = withTiming(activeLayout.width, cfg);
      return;
    }
    pillX.value = withSpring(activeLayout.x, bubbleSpring);
    pillW.value = withSpring(activeLayout.width, bubbleSpring);
  }, [activeLayout, bubbleSpring, dragging, pillW, pillX, reduce, staffAdaptive]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: Math.max(pillW.value, 0),
    opacity: pillW.value > 1 ? 1 : 0,
  }));

  const pillFillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + dragging.value * 0.04 }],
  }));

  if (tabs.length === 0) return null;

  if (floating) {
    const dark = colorScheme === 'dark';
    const shellBg = dark ? 'rgba(42,36,37,0.42)' : 'rgba(255,255,255,0.42)';
    const shellBorder = dark ? 'rgba(255,255,255,0.14)' : 'rgba(63,52,44,0.12)';
    const bubbleFill = dark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.92)';
    const bubbleBorder = dark ? 'rgba(255,255,255,0.32)' : 'rgba(63,52,44,0.14)';

    /**
     * Flat equal slots so onLayout x/width are relative to the track (pill math).
     * Nested left/right groups broke dealer layouts — pill sat between Home + Catalog.
     */
    const mid = Math.ceil(tabs.length / 2);
    type Slot =
      | { kind: 'tab'; tab: (typeof tabs)[number]; index: number }
      | { kind: 'fab' };
    const slots: Slot[] = dealerFab
      ? [
          ...tabs.slice(0, mid).map((tab, i) => ({ kind: 'tab' as const, tab, index: i })),
          { kind: 'fab' },
          ...tabs.slice(mid).map((tab, i) => ({
            kind: 'tab' as const,
            tab,
            index: mid + i,
          })),
        ]
      : tabs.map((tab, index) => ({ kind: 'tab' as const, tab, index }));

    const equalSlots = iconsOnly || staffAdaptive;

    const trackRowStyle = {
      flex: 1,
      flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
      alignItems: 'center' as const,
      // Visible so the glass capsule shadow isn’t clipped.
      overflow: 'visible' as const,
      borderRadius: ACTIVE_HEIGHT / 2,
    };

    const renderTabSlot = (tab: (typeof tabs)[number], index: number) => {
      const expanded = index === expandedIndex;
      const label = t(`mobile.tabs.${tab.labelKey}`);
      const iconName = TAB_ICONS[tab.name] ?? 'ellipse-outline';
      const highlighted =
        index === expandedIndex ||
        (expandedIndex < 0 && tab.name === activeName);
      const content = (
        <View
          collapsable={false}
          onLayout={
            staffAdaptive
              ? (e) => onContentLayout(tab.name, e.nativeEvent.layout.width)
              : undefined
          }
        >
          <TabItemContent
            iconName={iconName}
            label={label}
            expanded={expanded}
            isRTL={isRTL}
            color={highlighted ? colors.brand : colors.textMuted}
            iconsOnly={iconsOnly}
            hugContent={staffAdaptive}
          />
        </View>
      );

      const slotStyle = equalSlots
        ? {
            flex: 1 as const,
            minHeight: ACTIVE_HEIGHT,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            overflow: (staffAdaptive ? 'visible' : 'hidden') as 'visible' | 'hidden',
          }
        : undefined;

      return (
        <Pressable
          key={tab.name}
          accessibilityRole="button"
          accessibilityState={{ selected: tab.name === activeName }}
          accessibilityLabel={label}
          onLayout={(e) => onLayoutTab(tab.name, e)}
          onPress={() => go(tab.name)}
          style={[{ zIndex: 2 }, slotStyle]}
        >
          {content}
        </Pressable>
      );
    };

    const renderFabSpacer = (key: string) => (
      <View
        key={key}
        pointerEvents="none"
        style={{
          flex: 1,
          minWidth: DEALER_FAB_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    );

    const shellHeight = SHELL_PAD * 2 + ACTIVE_HEIGHT;
    const shellRadius = shellHeight / 2;

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
        {dealerFab ? (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: shellHeight / 2 - DEALER_FAB_SIZE / 2,
              alignItems: 'center',
              zIndex: 60,
            }}
          >
            <DealerNewOrderButton />
          </View>
        ) : null}

        <View
          style={{
            height: shellHeight,
            borderRadius: shellRadius,
            // Allow glass bubble shadows to breathe; BlurView is clipped separately.
            overflow: 'visible',
            borderWidth: 1,
            borderColor: shellBorder,
            ...theme.elevation.raised,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: shellRadius,
              overflow: 'hidden',
            }}
          >
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={dark ? 36 : 52}
                tint={dark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: shellBg }]}
            />
          </View>
          <View
            style={{
              flex: 1,
              padding: SHELL_PAD,
              overflow: 'visible',
            }}
          >
            <GestureDetector gesture={gesture}>
              <View
                style={[
                  trackRowStyle,
                  !equalSlots ? { justifyContent: 'space-between' as const } : null,
                ]}
              >
                {slots.map((slot) =>
                  slot.kind === 'fab'
                    ? renderFabSpacer('fab-slot')
                    : renderTabSlot(slot.tab, slot.index),
                )}

                {tabInBar && layoutsReady && activeLayout ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      {
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        borderRadius: ACTIVE_HEIGHT / 2,
                        overflow: 'visible',
                        zIndex: 0,
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
                          backgroundColor: bubbleFill,
                          borderWidth: StyleSheet.hairlineWidth * 2,
                          borderColor: bubbleBorder,
                          shadowColor: dark ? '#000' : '#1E1A1B',
                          shadowOpacity: dark ? 0.55 : 0.28,
                          shadowRadius: 10,
                          shadowOffset: { width: 0, height: 3 },
                          elevation: 8,
                        },
                        pillFillStyle,
                      ]}
                    />
                  </Animated.View>
                ) : null}
              </View>
            </GestureDetector>
          </View>
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
