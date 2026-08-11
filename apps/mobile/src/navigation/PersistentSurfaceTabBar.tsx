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
  useAnimatedStyle,
  withSpring,
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
/** Soft glide for admin label-expand pill. */
const PILL_SPRING = { damping: 20, stiffness: 110, mass: 1.15 } as const;
/**
 * Apple-like liquid bubble — slightly underdamped so it eases + settles
 * (closer to iOS tab / segmented control feel).
 */
const APPLE_BUBBLE_SPRING = { damping: 24, stiffness: 170, mass: 0.92 } as const;

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
  iconsOnly = false,
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
  /** Dealer bar: icons only, no expanding labels. */
  iconsOnly?: boolean;
}) {
  const color = ink === 'onBrand' ? onBrand : brand;
  const showLabel = !iconsOnly && expanded;
  return (
    <View
      style={{
        height: slotHeight,
        paddingHorizontal: showLabel ? 14 : 0,
        width: showLabel ? undefined : iconsOnly ? slotHeight : INACTIVE_SLOT,
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
  const tabNamesKey = useMemo(() => tabs.map((t) => t.name).join('|'), [tabs]);
  const activeName = activeTabFromPath(surface, pathname);
  /** Floating icon pill for admin, worker, and dealer. */
  const floating = surface === 'admin' || surface === 'employee' || surface === 'customer';
  const dealerFab =
    surface === 'customer' && Boolean(user && can(user, 'request.create'));
  /** Dealer: icon-only equal pills — no expanding labels. */
  const iconsOnly = surface === 'customer';
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
      if (!iconsOnly) return layout;
      // Equal pill centered in each flex slot.
      const pill = ACTIVE_HEIGHT;
      return {
        x: layout.x + Math.max(0, (layout.width - pill) / 2),
        width: pill,
      };
    });
  }, [layouts, tabs, iconsOnly]);
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
    [iconsOnly, reduce],
  );

  const bubbleSpring = iconsOnly ? APPLE_BUBBLE_SPRING : PILL_SPRING;

  const { pillX, pillW, dragging, gesture } = useDraggablePillBar({
    layouts: orderedLayouts,
    activeIndex: tabInBar ? activeIndex : 0,
    onSelectIndex,
    onScrubIndexChange,
    reduceMotion: reduce,
    enabled: floating && tabs.length > 0 && tabInBar,
    spring: bubbleSpring,
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
    setScrubIndex(null);
  }, [activeName]);

  useEffect(() => {
    // Remeasure only when the chip set actually changes (not on AuthUser identity churn).
    setLayouts({});
  }, [tabNamesKey, dealerFab]);

  // Spring the bubble to the active slot (instant assign killed Apple-like motion).
  useEffect(() => {
    if (!activeLayout || activeLayout.width <= 0) return;
    if (dragging.value) return;
    if (reduce) {
      pillX.value = activeLayout.x;
      pillW.value = activeLayout.width;
      return;
    }
    pillX.value = withSpring(activeLayout.x, bubbleSpring);
    pillW.value = withSpring(activeLayout.width, bubbleSpring);
  }, [activeLayout, bubbleSpring, dragging, pillW, pillX, reduce]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: Math.max(pillW.value, 0),
    opacity: pillW.value > 1 ? 1 : 0,
  }));

  const pillFillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + dragging.value * 0.04 }],
  }));

  const pillInkStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pillX.value }],
  }));

  if (tabs.length === 0) return null;

  if (floating) {
    const dark = colorScheme === 'dark';
    const glassShell = iconsOnly;
    const shellBg = glassShell
      ? dark
        ? 'rgba(42,36,37,0.42)'
        : 'rgba(255,255,255,0.42)'
      : dark
        ? 'rgba(42,36,37,0.94)'
        : 'rgba(255,255,255,0.96)';
    const shellBorder = glassShell
      ? dark
        ? 'rgba(255,255,255,0.14)'
        : 'rgba(63,52,44,0.12)'
      : colors.border;
    const bubbleFill = glassShell
      ? dark
        ? 'rgba(255,255,255,0.28)'
        : 'rgba(255,255,255,0.92)'
      : colors.brand;
    const bubbleBorder = glassShell
      ? dark
        ? 'rgba(255,255,255,0.32)'
        : 'rgba(63,52,44,0.14)'
      : 'transparent';

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

    const equalSlots = iconsOnly;

    const trackRowStyle = {
      flex: 1,
      flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
      alignItems: 'center' as const,
      // Visible so the glass capsule shadow isn’t clipped.
      overflow: (glassShell ? 'visible' : 'hidden') as 'visible' | 'hidden',
      borderRadius: ACTIVE_HEIGHT / 2,
    };

    const rowStyle = {
      flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
      alignItems: 'center' as const,
      height: ACTIVE_HEIGHT,
      width: trackWidth > 0 ? trackWidth : ('100%' as const),
    };

    const renderTabSlot = (
      tab: (typeof tabs)[number],
      index: number,
      ink: TabInk,
      opts?: { glassActive?: boolean },
    ) => {
      const expanded = index === expandedIndex;
      const label = t(`mobile.tabs.${tab.labelKey}`);
      const iconName = TAB_ICONS[tab.name] ?? 'ellipse-outline';
      const glassActive = Boolean(opts?.glassActive);
      // Glass bubble: active stays brand ink; inactive softens.
      const brandInk = glassActive
        ? tab.name === activeName
          ? colors.brand
          : colors.textMuted
        : colors.brand;
      const content = (
        <TabItemContent
          iconName={iconName}
          label={label}
          expanded={expanded}
          ink={ink}
          isRTL={isRTL}
          brand={brandInk}
          onBrand={colors.onBrand}
          iconsOnly={iconsOnly}
        />
      );

      const slotStyle = equalSlots
        ? {
            flex: 1 as const,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            overflow: 'hidden' as const,
          }
        : undefined;

      if (ink === 'onBrand') {
        return (
          <View key={`ink-${tab.name}`} style={slotStyle}>
            {content}
          </View>
        );
      }

      return (
        <Pressable
          key={tab.name}
          accessibilityRole="button"
          accessibilityState={{ selected: tab.name === activeName }}
          accessibilityLabel={label}
          onLayout={(e) => onLayoutTab(tab.name, e)}
          onPress={() => go(tab.name)}
          style={[{ zIndex: glassShell ? 2 : 1 }, slotStyle]}
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
            overflow: glassShell ? 'visible' : 'hidden',
            borderWidth: 1,
            borderColor: shellBorder,
            backgroundColor: glassShell ? undefined : shellBg,
            ...theme.elevation.raised,
          }}
        >
          {glassShell ? (
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
          ) : null}
          <View
            style={{
              flex: 1,
              padding: SHELL_PAD,
              overflow: glassShell ? 'visible' : 'hidden',
            }}
          >
            <GestureDetector gesture={gesture}>
              <View
                style={[
                  trackRowStyle,
                  !equalSlots ? { justifyContent: 'space-between' as const } : null,
                ]}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0 && w !== trackWidth) setTrackWidth(w);
                }}
              >
                {slots.map((slot) =>
                  slot.kind === 'fab'
                    ? renderFabSpacer('fab-slot')
                    : renderTabSlot(slot.tab, slot.index, 'brand', {
                        glassActive: glassShell,
                      }),
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
                        // Don’t clip glass bubble shadows.
                        overflow: glassShell ? 'visible' : 'hidden',
                        // Glass capsule sits behind icons; brand pill sits above for ink clip.
                        zIndex: glassShell ? 0 : 2,
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
                          borderWidth: glassShell ? StyleSheet.hairlineWidth * 2 : 0,
                          borderColor: bubbleBorder,
                          ...(glassShell
                            ? {
                                shadowColor: dark ? '#000' : '#1E1A1B',
                                shadowOpacity: dark ? 0.55 : 0.28,
                                shadowRadius: 10,
                                shadowOffset: { width: 0, height: 3 },
                                elevation: 8,
                              }
                            : null),
                        },
                        pillFillStyle,
                      ]}
                    />
                    {/* Solid brand bubble still clips on-brand ink; glass uses icons underneath. */}
                    {!glassShell ? (
                      <Animated.View
                        style={[
                          rowStyle,
                          !equalSlots ? { justifyContent: 'space-between' as const } : null,
                          pillInkStyle,
                        ]}
                      >
                        {slots.map((slot) =>
                          slot.kind === 'fab'
                            ? renderFabSpacer('ink-fab-slot')
                            : renderTabSlot(slot.tab, slot.index, 'onBrand'),
                        )}
                      </Animated.View>
                    ) : null}
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
