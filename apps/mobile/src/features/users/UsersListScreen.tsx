import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { Href } from 'expo-router';
import { localizedName } from '@maher/i18n';
import { can } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { UserRow } from '@/api/modules/users';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { CreateUserSheet } from './components/CreateUserSheet';
import { DepartmentPickerSheet } from './components/DepartmentPickerSheet';
import { EditUserSheet } from './components/EditUserSheet';
import { UserBoardCard } from './components/UserBoardCard';
import { UsersFilterTriggers } from './components/UsersFilterTriggers';
import { UsersSegmentRail } from './components/UsersSegmentRail';
import {
  UsersRoleFilterSheet,
  UsersStatusFilterSheet,
  type UserStatusFilter,
} from './components/UsersStatusFilterSheet';
import { localizedRoleName } from './display';
import {
  flattenUsers,
  useActivateUserMutation,
  useDeactivateUserMutation,
  useDepartmentsQuery,
  useRolesQuery,
  useUsersInfiniteQuery,
} from './query';
import { roleCodeForSegment, type UsersSegment } from './segment';

function UsersScreenTitle({ titleWeight }: { titleWeight: 'medium' | 'semibold' }) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          zIndex: 1,
          justifyContent: 'center',
        }}
      >
        <ScreenBackLead fallback={'/(app)/(admin)/(tabs)/more' as Href} />
      </View>
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
      >
        {t('users.title')}
      </AppText>
    </View>
  );
}

/**
 * Admin users hub — segments, search, filters, cards, add/edit sheets.
 */
export function UsersListScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const allowed = can(user, 'user.manage');

  const [segment, setSegment] = useState<UsersSegment>('staff');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [isActive, setIsActive] = useState<UserStatusFilter>('');
  const [roleCode, setRoleCode] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editPasswordMode, setEditPasswordMode] = useState(false);
  const [deptFilterOpen, setDeptFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [roleFilterOpen, setRoleFilterOpen] = useState(false);
  const [confirm, setConfirm] = useState<
    { type: 'activate' | 'deactivate'; user: UserRow } | null
  >(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 280);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    setRoleCode('');
    setDepartmentId('');
  }, [segment]);

  const showRoleFilter = segment === 'all';
  const showDepartmentFilter = segment !== 'customers';
  const showDepartmentColumn = segment !== 'customers';

  const listFilters = useMemo(() => {
    const segmentRole = roleCodeForSegment(segment);
    return {
      q: debouncedQ || undefined,
      isActive: isActive || undefined,
      roleCode: showRoleFilter ? roleCode || undefined : segmentRole,
      departmentId: showDepartmentFilter && departmentId ? departmentId : undefined,
    };
  }, [
    debouncedQ,
    departmentId,
    isActive,
    roleCode,
    segment,
    showDepartmentFilter,
    showRoleFilter,
  ]);

  const query = useUsersInfiniteQuery(listFilters, allowed);
  const rolesQuery = useRolesQuery(allowed);
  const departmentsQuery = useDepartmentsQuery(allowed && showDepartmentFilter);

  const activateMutation = useActivateUserMutation();
  const deactivateMutation = useDeactivateUserMutation();

  const rows = flattenUsers(query.data);
  const departments = departmentsQuery.data?.data ?? [];
  const roles = rolesQuery.data ?? [];

  /** Pull-to-refresh only — not segment / filter transitions. */
  const pullRefreshing =
    query.isRefetching && !query.isFetchingNextPage && !query.isPlaceholderData;

  /** Filter/segment in flight while previous results still show. */
  const isFilterUpdating =
    query.isFetching && !query.isFetchingNextPage && Boolean(query.data);

  const [animateEnter, setAnimateEnter] = useState(true);
  useEffect(() => {
    if (!animateEnter) return;
    if (!query.isFetched || query.isPlaceholderData) return;
    const id = setTimeout(() => setAnimateEnter(false), 520);
    return () => clearTimeout(id);
  }, [animateEnter, query.isFetched, query.isPlaceholderData]);

  const departmentLabel = useMemo(() => {
    if (!departmentId) return null;
    const dept = departments.find((d) => d.id === departmentId);
    return dept ? localizedName(locale, dept, dept.code) : null;
  }, [departmentId, departments, locale]);

  const roleLabel = useMemo(() => {
    if (!roleCode) return null;
    const role = roles.find((r) => r.code === roleCode);
    return role ? localizedRoleName(role, locale) : roleCode;
  }, [locale, roleCode, roles]);

  const statusLabel = useMemo(() => {
    if (isActive === 'true') return t('users.active');
    if (isActive === 'false') return t('users.inactive');
    return t('common.all');
  }, [isActive, t]);

  const roleOptions = useMemo(
    () =>
      roles.map((r) => ({
        id: r.id,
        code: r.code,
        label: localizedRoleName(r, locale),
      })),
    [locale, roles],
  );

  const runConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.type === 'activate') {
        await activateMutation.mutateAsync(confirm.user.id);
        void haptics.confirmLight();
        showToast({ variant: 'success', message: t('users.activated') });
      } else {
        await deactivateMutation.mutateAsync(confirm.user.id);
        void haptics.confirmLight();
        showToast({ variant: 'success', message: t('users.deactivated') });
      }
      setConfirm(null);
    } catch (err) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('common.actionFailed'),
      });
    }
  };

  const openEdit = (user: UserRow, passwordMode = false) => {
    setEditPasswordMode(passwordMode);
    setEditing(user);
  };

  const closeEdit = () => {
    setEditing(null);
    setEditPasswordMode(false);
  };

  if (!allowed) {
    return (
      <AppScreen>
        <UsersScreenTitle titleWeight={titleWeight} />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <AppScreen>
        <UsersScreenTitle titleWeight={titleWeight} />
        <AppText variant="body" color="secondary">
          {t('mobile.loadingSession')}
        </AppText>
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen>
        <UsersScreenTitle titleWeight={titleWeight} />
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.adminHome.errorTitle')}
          description={t('mobile.adminHome.errorBody')}
          retryLabel={t('mobile.adminHome.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            void query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
          flexGrow: 1,
        }}
        style={{ opacity: isFilterUpdating ? 0.72 : 1 }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            <UsersScreenTitle titleWeight={titleWeight} />
            {showOfflineBanner ? <OfflineBanner /> : null}

            <PrimaryButton
              label={t('users.add')}
              onPress={() => {
                void haptics.selection();
                setCreateOpen(true);
              }}
              style={{
                borderRadius: theme.radius.full,
                minHeight: theme.sizes.touch.min,
                paddingVertical: 0,
              }}
            />

            <UsersSegmentRail
              value={segment}
              onChange={(next) => {
                setSegment(next);
              }}
            />

            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                padding: theme.spacing.md,
                gap: theme.spacing.md,
                ...orderBoardShadow(colorScheme),
              }}
            >
              <SearchBarShell>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder={t('users.searchPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.searchInput,
                    {
                      color: colors.textPrimary,
                      textAlign: isRTL ? 'right' : 'left',
                      writingDirection: isRTL ? 'rtl' : 'ltr',
                    },
                    resolveAppFontStyle(locale, { variant: 'body' }),
                  ]}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
              </SearchBarShell>

              <UsersFilterTriggers
                showDepartment={showDepartmentFilter}
                departmentLabel={departmentLabel}
                onOpenDepartment={() => setDeptFilterOpen(true)}
                onClearDepartment={() => setDepartmentId('')}
                statusLabel={statusLabel}
                statusActive={Boolean(isActive)}
                onOpenStatus={() => setStatusFilterOpen(true)}
                showRole={showRoleFilter}
                roleLabel={roleLabel}
                onOpenRole={() => setRoleFilterOpen(true)}
                onClearRole={() => setRoleCode('')}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('users.empty')}
            description={t('mobile.users.emptyBody')}
          />
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index} enabled={animateEnter}>
            <UserBoardCard
              user={item}
              showDepartment={showDepartmentColumn}
              onEdit={() => openEdit(item)}
              onToggleActive={() =>
                setConfirm({
                  type: item.isActive ? 'deactivate' : 'activate',
                  user: item,
                })
              }
              onSetPassword={() => openEdit(item, true)}
            />
          </ListItemEnter>
        )}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <AppText variant="caption" color="muted" align="center">
              {t('common.loading')}
            </AppText>
          ) : isFilterUpdating ? (
            <AppText variant="caption" color="muted" align="center">
              {t('common.loading')}
            </AppText>
          ) : null
        }
      />

      <CreateUserSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        segment={segment}
      />
      <EditUserSheet
        open={Boolean(editing)}
        onClose={closeEdit}
        user={editing}
        passwordMode={editPasswordMode}
      />

      <DepartmentPickerSheet
        open={deptFilterOpen}
        onClose={() => setDeptFilterOpen(false)}
        departments={departments}
        selectedId={departmentId || null}
        onSelect={(id) => setDepartmentId(id ?? '')}
        allowNone
      />
      <UsersStatusFilterSheet
        open={statusFilterOpen}
        onClose={() => setStatusFilterOpen(false)}
        value={isActive}
        onApply={setIsActive}
      />
      <UsersRoleFilterSheet
        open={roleFilterOpen}
        onClose={() => setRoleFilterOpen(false)}
        roles={roleOptions}
        value={roleCode}
        onApply={setRoleCode}
      />

      <ConfirmationSheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.type === 'activate' ? t('users.activate') : t('users.deactivate')}
        message={
          confirm?.type === 'activate'
            ? t('users.confirmActivate')
            : t('users.confirmDeactivate')
        }
        confirmLabel={
          confirm?.type === 'activate' ? t('users.activate') : t('users.deactivate')
        }
        cancelLabel={t('common.cancel')}
        destructive={confirm?.type === 'deactivate'}
        onConfirm={() => void runConfirm()}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    paddingVertical: 0,
  },
});
