import type { Href } from 'expo-router';
import type { Ionicons } from '@expo/vector-icons';
import type { AuthUser } from '@maher/types';
import type { AppSurface } from '@maher/permissions';
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
