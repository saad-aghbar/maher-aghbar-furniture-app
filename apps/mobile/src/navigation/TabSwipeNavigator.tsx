import { type ReactNode, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { usePathname, useRouter } from 'expo-router';
import type { AppSurface } from '@maher/permissions';
import { useMaherLayout } from '@/adaptive/useMaherLayout';
import { useAuth } from '@/auth/AuthProvider';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { activeTabFromPath } from './activeTabFromPath';
import { isTabRootPath } from './isTabRootPath';
import { navigateToTab } from './navigateToTab';
import { visibleTabsForUser } from './tabConfig';

type Props = {
  surface: AppSurface;
  children: ReactNode;
};

/**
 * Horizontal swipe between bottom tabs — only while on a tab root, and only
 * in COMPACT (phone) chrome. The GestureDetector root stays mounted so a
 * window-class change never remounts authenticated children.
 */
export function TabSwipeNavigator({ surface, children }: Props) {
  const { user } = useAuth();
  const { isRTL } = useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { isCompact } = useMaherLayout({ surface });

  const tabs = useMemo(
    () => (user ? visibleTabsForUser(surface, user) : []),
    [surface, user],
  );
  const activeName = activeTabFromPath(surface, pathname);
  const onRoot = isTabRootPath(pathname, surface);
  const enabled = isCompact && onRoot && tabs.length > 1;

  const goAdjacent = useCallback(
    (dir: 1 | -1) => {
      if (tabs.length < 2) return;
      const idx = tabs.findIndex((t) => t.name === activeName);
      if (idx < 0) return;
      const next = tabs[idx + dir];
      if (!next) return;
      void haptics.selection();
      navigateToTab(router, surface, next.name, pathname);
    },
    [activeName, pathname, router, surface, tabs],
  );

  const gesture = useMemo(() => {
    const swipeLeftMeansNext = !isRTL;
    return Gesture.Pan()
      .enabled(enabled)
      .activeOffsetX([-48, 48])
      .failOffsetY([-12, 12])
      .maxPointers(1)
      .onEnd((e) => {
        'worklet';
        const far = Math.abs(e.translationX) >= 64;
        const fast = Math.abs(e.velocityX) >= 700;
        if (!far && !fast) return;
        if (Math.abs(e.translationY) > Math.abs(e.translationX) * 0.6) return;
        const toNext = swipeLeftMeansNext ? e.translationX < 0 : e.translationX > 0;
        runOnJS(goAdjacent)(toNext ? 1 : -1);
      });
  }, [enabled, goAdjacent, isRTL]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1, backgroundColor: colors.background }} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}
