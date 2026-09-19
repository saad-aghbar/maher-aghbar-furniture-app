import type { Href } from 'expo-router';
import type { Ionicons } from '@expo/vector-icons';
import { can, type AppSurface } from '@maher/permissions';
import type { AuthUser } from '@maher/types';
import {
  filterAdminOverflowModules,
  type AdminOverflowModule,
} from '@/features/admin-home/adminOverflowModules';
import { tabHref } from './navigateToTab';
import { visibleTabsForUser, type TabName } from './tabConfig';

export type AdminSideNavKind = 'tab' | 'module';

export type AdminSideNavItem = {
  kind: AdminSideNavKind;
  key: string;
  labelKey: string;
  hintKey?: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
  /** Tab name for tab items — used for selected-state via `activeTabFromPath`. */
  tabName?: TabName;
};

const TAB_ICONS: Partial<Record<TabName, keyof typeof Ionicons.glyphMap>> = {
  index: 'home-outline',
  orders: 'cube-outline',
  inventory: 'layers-outline',
  production: 'construct-outline',
  more: 'ellipsis-horizontal-outline',
};

function pathSegments(path: string): string[] {
  return path.split('/').filter((s) => s.length > 0 && !s.startsWith('('));
}

/** True when `pathname` is this module (or a nested screen under it). */
export function isAdminModulePath(pathname: string, href: string): boolean {
  const want = pathSegments(href);
  const have = pathSegments(pathname);
  if (want.length === 0) return false;
  for (let i = 0; i <= have.length - want.length; i += 1) {
    if (want.every((seg, j) => have[i + j] === seg)) return true;
  }
  return false;
}

function tabItem(tab: { name: TabName; labelKey: string }, surface: AppSurface): AdminSideNavItem {
  return {
    kind: 'tab',
    key: `tab:${tab.name}`,
    labelKey: `mobile.tabs.${tab.labelKey}`,
    icon: TAB_ICONS[tab.name] ?? 'ellipse-outline',
    href: tabHref(surface, tab.name),
    tabName: tab.name,
  };
}

function moduleItem(mod: AdminOverflowModule): AdminSideNavItem {
  return {
    kind: 'module',
    key: `mod:${mod.key}`,
    labelKey: mod.labelKey,
    hintKey: mod.hintKey,
    icon: mod.icon,
    href: mod.href,
  };
}

/**
 * Canonical admin rail/sidebar items from the same tab + overflow sources as
 * phone navigation. Rail = primary tabs (incl. More). Sidebar = primary tabs
 * without More, plus overflow modules (More is no longer the dump).
 */
export function adminSideNavItems(
  user: AuthUser | null | undefined,
  mode: 'rail' | 'sidebar',
): { primary: AdminSideNavItem[]; overflow: AdminSideNavItem[] } {
  if (!user) return { primary: [], overflow: [] };
  const tabs = visibleTabsForUser('admin', user);
  const primaryTabs =
    mode === 'sidebar' ? tabs.filter((tab) => tab.name !== 'more') : tabs;
  const primary = primaryTabs.map((tab) => tabItem(tab, 'admin'));
  const overflow =
    mode === 'sidebar'
      ? filterAdminOverflowModules(user, 'more').map(moduleItem)
      : [];
  return { primary, overflow };
}

export const ADMIN_MORE_HREF = '/(app)/(admin)/more' as Href;

export type AdminAccountSheetItem = {
  key: 'account' | 'notifications' | 'settings';
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
};

/** Account / notifications / factory settings for the pinned sidebar sheet. */
export function adminAccountSheetItems(
  user: AuthUser | null | undefined,
): AdminAccountSheetItem[] {
  const items: AdminAccountSheetItem[] = [
    {
      key: 'account',
      labelKey: 'mobile.more.manageAccount',
      icon: 'person-outline',
      href: '/(app)/(admin)/more/account' as Href,
    },
    {
      key: 'notifications',
      labelKey: 'mobile.notifications.prefs.title',
      icon: 'notifications-outline',
      href: '/(app)/(admin)/more/notifications' as Href,
    },
  ];
  if (user && can(user, 'settings.manage')) {
    items.push({
      key: 'settings',
      labelKey: 'mobile.more.moreSettings',
      icon: 'business-outline',
      href: '/(app)/(admin)/more/settings' as Href,
    });
  }
  return items;
}

/** True when the admin More hub or a nested account screen is showing. */
export function isAdminAccountPath(pathname: string): boolean {
  return isAdminModulePath(pathname, String(ADMIN_MORE_HREF));
}

export function selectedAdminSideNavKey(
  items: readonly AdminSideNavItem[],
  pathname: string,
  activeTab: TabName,
): string | null {
  const moduleHit = items.find(
    (item) => item.kind === 'module' && isAdminModulePath(pathname, String(item.href)),
  );
  if (moduleHit) return moduleHit.key;
  const tabHit = items.find((item) => item.kind === 'tab' && item.tabName === activeTab);
  return tabHit?.key ?? null;
}
