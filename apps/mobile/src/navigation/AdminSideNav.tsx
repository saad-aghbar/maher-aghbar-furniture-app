import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { useMaherDensity } from '@/adaptive/density';
import { displayRolesLabel } from '@/i18n/roleLabel';
import { localeRow, pinStart, useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { AdminAccountSheet } from './AdminAccountSheet';
import { activeTabFromPath } from './activeTabFromPath';
import {
  adminAccountSheetItems,
  adminSideNavItems,
  isAdminAccountPath,
  selectedAdminSideNavKey,
  type AdminSideNavItem,
} from './adminSideNavItems';
import { navigateToTab } from './navigateToTab';

type Props = {
  mode: 'rail' | 'sidebar';
};

/**
 * Maher parchment rail / sidebar. Same routes and permission filtering as the
 * phone tab bar + More atlas. Not a Material NavigationRail.
 */
export function AdminSideNav({ mode }: Props) {
  const { user, logout } = useAuth();
  const { colors, theme } = useTheme();
  const { t, isRTL, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const density = useMaherDensity();
  const router = useRouter();
  const pathname = usePathname();
  const { primary, overflow } = adminSideNavItems(user, mode);
  const items = [...primary, ...overflow];
  const activeTab = activeTabFromPath('admin', pathname);
  const selectedKey = selectedAdminSideNavKey(items, pathname, activeTab);
  const accountSelected = isAdminAccountPath(pathname);
  const sheetItems = adminAccountSheetItems(user);
  const [accountOpen, setAccountOpen] = useState(false);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const width = mode === 'rail' ? density.railWidth : density.sidebarWidth;
  const displayName = user?.name?.trim() || user?.username || t('mobile.more.accountEyebrow');
  const roleCaption = displayRolesLabel(t, user, locale);

  const onPress = useCallback(
    (item: AdminSideNavItem) => {
      void haptics.selection();
      if (item.kind === 'tab' && item.tabName) {
        navigateToTab(router, 'admin', item.tabName, pathname);
        return;
      }
      router.navigate(item.href);
    },
    [pathname, router],
  );

  if (items.length === 0) return null;

  return (
    <View
      testID={`admin-side-nav-${mode}`}
      style={{
        width,
        minWidth: width,
        maxWidth: width,
        alignSelf: 'stretch',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        ...(isRTL ? { borderLeftWidth: 1 } : { borderRightWidth: 1 }),
        paddingTop: insets.top + theme.spacing.sm,
        paddingBottom: Math.max(insets.bottom, theme.spacing.sm),
      }}
    >
      {mode === 'sidebar' ? (
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingBottom: theme.spacing.md,
            gap: 2,
          }}
        >
          <AppText
            variant="caption"
            color="brand"
            weight={titleWeight}
            style={locale === 'ar' ? undefined : { letterSpacing: 0.5 }}
          >
            {t('mobile.adaptive.navFloor')}
          </AppText>
        </View>
      ) : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: mode === 'rail' ? theme.spacing.xs : theme.spacing.sm,
          gap: theme.spacing.xs,
          paddingBottom: theme.spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {primary.map((item) => (
          <NavRow
            key={item.key}
            item={item}
            mode={mode}
            selected={item.key === selectedKey}
            onPress={() => onPress(item)}
          />
        ))}
        {mode === 'sidebar' && overflow.length > 0 ? (
          <View
            style={{
              marginTop: theme.spacing.md,
              marginBottom: theme.spacing.xs,
              paddingHorizontal: theme.spacing.sm,
            }}
          >
            <AppText variant="caption" color="muted" weight={titleWeight}>
              {t('mobile.adaptive.navFactory')}
            </AppText>
            <View
              style={{
                height: 1,
                backgroundColor: colors.borderMuted,
                marginTop: theme.spacing.xs,
              }}
            />
          </View>
        ) : null}
        {overflow.map((item) => (
          <NavRow
            key={item.key}
            item={item}
            mode={mode}
            selected={item.key === selectedKey}
            onPress={() => onPress(item)}
          />
        ))}
      </ScrollView>
      <AccountFooter
        mode={mode}
        selected={accountSelected}
        displayName={displayName}
        roleCaption={roleCaption}
        onPress={() => {
          void haptics.selection();
          setAccountOpen(true);
        }}
      />
      <AdminAccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        items={sheetItems}
        onNavigate={(href: Href) => {
          router.navigate(href);
        }}
        onLogout={() => {
          void logout().then(() => router.replace('/(auth)/login' as Href));
        }}
      />
    </View>
  );
}

function AccountFooter({
  mode,
  selected,
  displayName,
  roleCaption,
  onPress,
}: {
  mode: 'rail' | 'sidebar';
  selected: boolean;
  displayName: string;
  roleCaption: string;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  const { t, isRTL, locale } = useLocale();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const rail = mode === 'rail';
  const a11y = t('mobile.more.accountEyebrow');

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: rail ? theme.spacing.xs : theme.spacing.sm,
        paddingTop: theme.spacing.sm,
      }}
    >
      <AnimatedPressable
        variant="button"
        testID="admin-side-nav-account"
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ selected }}
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          minHeight: rail ? 52 : theme.sizes.touch.min,
          flexDirection: localeRow(isRTL),
          alignItems: 'center',
          justifyContent: rail ? 'center' : 'flex-start',
          gap: theme.spacing.sm,
          paddingHorizontal: rail ? 0 : theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radius.md,
          backgroundColor: selected
            ? colors.brandSoft
            : hovered
              ? colors.surfaceSecondary
              : 'transparent',
          borderWidth: focused ? 1.5 : 0,
          borderColor: colors.brand,
        }}
      >
        {selected ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 8,
              bottom: 8,
              width: 3,
              borderRadius: 2,
              backgroundColor: colors.brand,
              ...pinStart(isRTL),
            }}
          />
        ) : null}
        <Ionicons
          name="person-circle-outline"
          size={22}
          color={selected ? colors.brand : colors.textSecondary}
        />
        {rail ? null : (
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText
              variant="body"
              weight={titleWeight}
              numberOfLines={1}
              color={selected ? 'brand' : 'primary'}
            >
              {displayName}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {roleCaption}
            </AppText>
          </View>
        )}
      </AnimatedPressable>
    </View>
  );
}

function NavRow({
  item,
  mode,
  selected,
  onPress,
}: {
  item: AdminSideNavItem;
  mode: 'rail' | 'sidebar';
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  const { t, isRTL, locale } = useLocale();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const label = t(item.labelKey);
  const rail = mode === 'rail';

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        minHeight: rail ? 52 : theme.sizes.touch.min,
        flexDirection: localeRow(isRTL),
        alignItems: 'center',
        justifyContent: rail ? 'center' : 'flex-start',
        gap: theme.spacing.sm,
        paddingHorizontal: rail ? 0 : theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: selected
          ? colors.brandSoft
          : hovered
            ? colors.surfaceSecondary
            : 'transparent',
        borderWidth: focused ? 1.5 : 0,
        borderColor: colors.brand,
      }}
    >
      {selected ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 2,
            backgroundColor: colors.brand,
            ...pinStart(isRTL),
          }}
        />
      ) : null}
      <Ionicons
        name={item.icon}
        size={22}
        color={selected ? colors.brand : colors.textSecondary}
      />
      {rail ? null : (
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText
            variant="body"
            weight={titleWeight}
            numberOfLines={1}
            color={selected ? 'brand' : 'primary'}
          >
            {label}
          </AppText>
        </View>
      )}
    </AnimatedPressable>
  );
}
