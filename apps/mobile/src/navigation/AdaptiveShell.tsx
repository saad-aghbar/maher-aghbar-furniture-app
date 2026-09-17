import { type ReactNode } from 'react';
import { View } from 'react-native';
import type { AppSurface } from '@maher/permissions';
import { AdaptiveSurfaceProvider } from '@/adaptive/AdaptiveSurfaceContext';
import { KeyboardShortcutsHost } from '@/adaptive/keyboardShortcuts';
import { useMaherLayout } from '@/adaptive/useMaherLayout';
import { localeRow, useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { AdminSideNav } from './AdminSideNav';
import { PersistentSurfaceTabBar } from './PersistentSurfaceTabBar';
import { TabSwipeNavigator } from './TabSwipeNavigator';

type Props = {
  surface: AppSurface;
  children: ReactNode;
};

/**
 * Authenticated chrome: stable tab-swipe root, admin rail/sidebar, phone pill.
 * Children (the Expo Stack) stay in the same tree position across window-class
 * changes so business screens never remount on resize.
 */
export function AdaptiveShell({ surface, children }: Props) {
  return (
    <AdaptiveSurfaceProvider surface={surface}>
      <KeyboardShortcutsHost>
        <AdaptiveShellInner surface={surface}>{children}</AdaptiveShellInner>
      </KeyboardShortcutsHost>
    </AdaptiveSurfaceProvider>
  );
}

function AdaptiveShellInner({ surface, children }: Props) {
  const { colors } = useTheme();
  const { isRTL } = useLocale();
  const { navigationMode } = useMaherLayout({ surface });
  const showSide =
    surface === 'admin' && (navigationMode === 'rail' || navigationMode === 'sidebar');

  return (
    <TabSwipeNavigator surface={surface}>
      <View
        style={{
          flex: 1,
          flexDirection: localeRow(isRTL),
          backgroundColor: colors.background,
        }}
      >
        {showSide ? (
          <AdminSideNav mode={navigationMode === 'rail' ? 'rail' : 'sidebar'} />
        ) : (
          <View testID="admin-side-nav-placeholder" collapsable={false} style={{ width: 0 }} />
        )}
        <View style={{ flex: 1, minWidth: 0, backgroundColor: colors.background }}>
          {children}
          <PersistentSurfaceTabBar surface={surface} />
        </View>
      </View>
    </TabSwipeNavigator>
  );
}
