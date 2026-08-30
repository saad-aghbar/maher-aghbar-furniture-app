import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedName } from '@maher/i18n';
import { can } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { UserRow } from '@/api/modules/users';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
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
  UsersFilterSheet,
  UsersRoleFilterSheet,
  type UserStatusFilter,
} from './components/UsersStatusFilterSheet';
import { localizedRoleName } from './display';
import {
  flattenUsers,
  useActivateUserMutation,
  useDeactivateUserMutation,
  useDeleteUserMutation,
  useDepartmentsQuery,
  useStaffTypesQuery,
  useUsersInfiniteQuery,
} from './query';
import { roleKindForSegment, type UsersSegment } from './segment';
import { useStageLibraryQuery } from '@/features/workflow/query';
import { AppTextInput } from '@/components/forms/AppTextInput';

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
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const allowed = can(user, 'user.manage');
  /** Last-card inset: home indicator + floating tab bar (same as other leftover PRs). */
  const listBottomClearance = insets.bottom + SURFACE_TAB_BAR_CLEARANCE;

  const [segment, setSegment] = useState<UsersSegment>('workers');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [isActive, setIsActive] = useState<UserStatusFilter>('');
  const [stageDefinitionId, setStageDefinitionId] = useState('');
  const [staffTypeId, setStaffTypeId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editPasswordMode, setEditPasswordMode] = useState(false);
  const [deptFilterOpen, setDeptFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [staffTypeFilterOpen, setStaffTypeFilterOpen] = useState(false);
  const [confirm, setConfirm] = useState<
    { type: 'activate' | 'deactivate' | 'delete'; user: UserRow } | null
  >(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 280);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    setStageDefinitionId('');
    setDepartmentId('');
    setStaffTypeId('');
  }, [segment]);

  const showStaffTypeFilter = segment === 'staff';
  // Department is unused for Worker/Admin/Customer/Staff; only relevant for other roles under "all".
  const showDepartmentFilter = segment === 'all';
  const showDepartmentColumn = segment === 'all';
  const canManageStaffTypes = can(user, 'role.manage');

  const listFilters = useMemo(() => {
    const roleKind = roleKindForSegment(segment);
    return {
      q: debouncedQ || undefined,
      isActive: isActive || undefined,
      stageDefinitionId: stageDefinitionId || undefined,
      roleKind: showStaffTypeFilter && staffTypeId ? undefined : roleKind,
      staffTypeId: showStaffTypeFilter && staffTypeId ? staffTypeId : undefined,
      departmentId: showDepartmentFilter && departmentId ? departmentId : undefined,
    };
  }, [
    debouncedQ,
    departmentId,
    isActive,
    stageDefinitionId,
    segment,
    showDepartmentFilter,
    showStaffTypeFilter,
    staffTypeId,
  ]);

  const query = useUsersInfiniteQuery(listFilters, allowed);
  const staffTypesQuery = useStaffTypesQuery(allowed && showStaffTypeFilter, { isActive: true });
  const departmentsQuery = useDepartmentsQuery(allowed && showDepartmentFilter);
  const stagesQuery = useStageLibraryQuery(allowed);

  const activateMutation = useActivateUserMutation();
  const deactivateMutation = useDeactivateUserMutation();
  const deleteMutation = useDeleteUserMutation();

  const rows = flattenUsers(query.data);
  const departments = departmentsQuery.data?.data ?? [];
  const staffTypes = staffTypesQuery.data ?? [];
  const stages = stagesQuery.data ?? [];

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

  const skillLabel = useMemo(() => {
    if (!stageDefinitionId) return null;
    const stage = stages.find((s) => s.id === stageDefinitionId);
    return stage ? localizedName(locale, stage, stage.code) : null;
  }, [locale, stageDefinitionId, stages]);

  const staffTypeLabel = useMemo(() => {
    if (!staffTypeId) return null;
    const type = staffTypes.find((r) => r.id === staffTypeId);
    return type ? localizedRoleName(type, locale) : null;
  }, [locale, staffTypeId, staffTypes]);

  const statusLabel = useMemo(() => {
    if (isActive === 'true') return t('users.active');
    if (isActive === 'false') return t('users.inactive');
    return null;
  }, [isActive, t]);

  const filterActiveCount = (isActive ? 1 : 0) + (stageDefinitionId ? 1 : 0);

  const filterSummary = useMemo(() => {
    if (filterActiveCount === 0) return null;
    const parts = [statusLabel, skillLabel].filter(Boolean);
    return parts.length ? parts.join(' · ') : t('users.filterTitle');
  }, [filterActiveCount, skillLabel, statusLabel, t]);

  const skillOptions = useMemo(
    () =>
      stages
        .filter((s) => s.isActive)
        .map((s) => ({
          id: s.id,
          label: localizedName(locale, s, s.code),
        })),
    [locale, stages],
  );

  const staffTypeOptions = useMemo(
    () =>
      staffTypes.map((r) => ({
        id: r.id,
        code: r.id,
        label: localizedRoleName(r, locale),
      })),
    [locale, staffTypes],
  );

  const runConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.type === 'activate') {
        await activateMutation.mutateAsync(confirm.user.id);
        void haptics.confirmLight();
        showToast({ variant: 'success', message: t('users.activated') });
      } else if (confirm.type === 'delete') {
        await deleteMutation.mutateAsync(confirm.user.id);
        void haptics.confirmLight();
        showToast({ variant: 'success', message: t('users.deleted') });
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
          flexGrow: 1,
        }}
        style={{ flex: 1, opacity: isFilterUpdating ? 0.72 : 1 }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            <UsersScreenTitle titleWeight={titleWeight} />
            {showOfflineBanner ? <OfflineBanner /> : null}

            <View style={{ gap: theme.spacing.sm }}>
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
              {canManageStaffTypes ? (
                <SecondaryButton
                  label={t('users.staffTypes')}
                  onPress={() => {
                    void haptics.selection();
                    router.push('/(app)/(admin)/users/staff-types' as Href);
                  }}
                  style={{
                    borderRadius: theme.radius.full,
                    minHeight: theme.sizes.touch.min,
                    paddingVertical: 0,
                  }}
                />
              ) : null}
            </View>

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
                <AppTextInput
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
                filterSummary={filterSummary}
                filterActiveCount={filterActiveCount}
                onOpenFilter={() => setStatusFilterOpen(true)}
                showStaffType={showStaffTypeFilter}
                staffTypeLabel={staffTypeLabel}
                onOpenStaffType={() => setStaffTypeFilterOpen(true)}
                onClearStaffType={() => setStaffTypeId('')}
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
              onDelete={
                item.id !== user?.id
                  ? () => setConfirm({ type: 'delete', user: item })
                  : undefined
              }
            />
          </ListItemEnter>
        )}
        ListFooterComponent={
          <View>
            {query.isFetchingNextPage || isFilterUpdating ? (
              <AppText variant="caption" color="muted" align="center">
                {t('common.loading')}
              </AppText>
            ) : null}
            <View
              pointerEvents="none"
              style={{ height: listBottomClearance }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          </View>
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
      <UsersFilterSheet
        open={statusFilterOpen}
        onClose={() => setStatusFilterOpen(false)}
        value={{ isActive, stageDefinitionId }}
        skills={skillOptions}
        onApply={(next) => {
          setIsActive(next.isActive);
          setStageDefinitionId(next.stageDefinitionId);
        }}
      />
      <UsersRoleFilterSheet
        open={staffTypeFilterOpen}
        onClose={() => setStaffTypeFilterOpen(false)}
        roles={staffTypeOptions}
        value={staffTypeId}
        onApply={setStaffTypeId}
        titleKey="users.staffType"
        allLabelKey="users.staffTypeFilterAll"
      />

      <ConfirmationSheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={
          confirm?.type === 'activate'
            ? t('users.activate')
            : confirm?.type === 'delete'
              ? t('common.delete')
              : t('users.deactivate')
        }
        message={
          confirm?.type === 'activate'
            ? t('users.confirmActivate')
            : confirm?.type === 'delete'
              ? t('users.confirmDelete')
              : t('users.confirmDeactivate')
        }
        confirmLabel={
          confirm?.type === 'activate'
            ? t('users.activate')
            : confirm?.type === 'delete'
              ? t('common.delete')
              : t('users.deactivate')
        }
        cancelLabel={t('common.cancel')}
        destructive={confirm?.type === 'deactivate' || confirm?.type === 'delete'}
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
