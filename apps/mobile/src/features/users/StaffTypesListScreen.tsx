import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { StaffTypeRow } from '@/api/modules/users';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { surfaceListBottomInset } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { StaffTypeBoardCard } from './components/StaffTypeBoardCard';
import {
  useDeactivateStaffTypeMutation,
  useDeleteStaffTypeMutation,
  useDuplicateStaffTypeMutation,
  useStaffTypesQuery,
} from './query';

type ConfirmAction = { type: 'deactivate' | 'delete'; item: StaffTypeRow };

/**
 * Staff types list — view, duplicate, deactivate, delete. Full permission editor also on Admin Web.
 */
export function StaffTypesListScreen() {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  /** Footer spacer so the last card's View/Duplicate row clears the floating tab bar. */
  const listBottomInset = surfaceListBottomInset(theme.spacing['3xl'], insets.bottom);
  const query = useStaffTypesQuery(true, {});
  const duplicateMutation = useDuplicateStaffTypeMutation();
  const deactivateMutation = useDeactivateStaffTypeMutation();
  const deleteMutation = useDeleteStaffTypeMutation();
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  const rows = query.data ?? [];

  const openNew = () => {
    void haptics.selection();
    router.push('/(app)/(admin)/users/staff-types/new' as Href);
  };

  const openType = (id: string) => {
    router.push(`/(app)/(admin)/users/staff-types/${id}` as Href);
  };

  const duplicate = (id: string) => {
    duplicateMutation.mutate(id, {
      onSuccess: (row) => {
        showToast({ variant: 'success', message: t('users.staffTypeDuplicated') });
        openType(row.id);
      },
      onError: (err) => {
        showToast({
          variant: 'error',
          message: isApiError(err) ? toastMessageForError(err) : t('common.actionFailed'),
        });
      },
    });
  };

  const requestDelete = (item: StaffTypeRow) => {
    if (item.isSystem) {
      showToast({ variant: 'error', message: t('users.cannotDeleteSystemPreset') });
      return;
    }
    if ((item._count?.users ?? 0) > 0) {
      showToast({ variant: 'error', message: t('users.cannotDeleteAssigned') });
      return;
    }
    setConfirm({ type: 'delete', item });
  };

  const actionError = (err: unknown) =>
    isApiError(err) ? toastMessageForError(err) : t('common.actionFailed');

  return (
    <AppScreen>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing.md,
          flexGrow: 1,
        }}
        ListFooterComponent={<View pointerEvents="none" style={{ height: listBottomInset }} />}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            <View style={{ minHeight: theme.sizes.touch.min, justifyContent: 'center' }}>
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
                <ScreenBackLead fallback={'/(app)/(admin)/users' as Href} />
              </View>
              <AppText
                variant="largeTitle"
                weight={titleWeight}
                align="center"
                numberOfLines={1}
                style={{ paddingHorizontal: theme.sizes.touch.min + theme.spacing.sm }}
              >
                {t('users.staffTypesTitle')}
              </AppText>
            </View>

            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                overflow: 'hidden',
                ...orderBoardShadow(colorScheme),
              }}
            >
              <View
                style={{
                  padding: theme.spacing.lg,
                  gap: theme.spacing.md,
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.brandSoft,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons name="briefcase-outline" size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                    <AppText
                      variant="caption"
                      color="brand"
                      style={{
                        letterSpacing: locale === 'ar' ? 0 : 0.7,
                        textTransform: locale === 'ar' ? 'none' : 'uppercase',
                        fontSize: 11,
                      }}
                    >
                      {t('users.staffTypesEyebrow')}
                    </AppText>
                    <AppText variant="caption" color="muted">
                      {t('users.staffTypesCount', { n: rows.length })}
                    </AppText>
                  </View>
                </View>
                <AppText
                  variant="bodySecondary"
                  color="secondary"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('users.staffTypesDescription')}
                </AppText>
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('users.newStaffType')}
                  onPress={openNew}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    minHeight: theme.sizes.touch.min,
                    borderRadius: theme.radius.full,
                    backgroundColor: colors.brand,
                  }}
                >
                  <Ionicons name="add" size={18} color={colors.onBrand} />
                  <AppText color="onBrand" weight={titleWeight}>
                    {t('users.newStaffType')}
                  </AppText>
                </AnimatedPressable>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          query.isError ? (
            <ErrorState
              title={t('users.staffTypesTitle')}
              description={t('mobile.adminHome.errorBody')}
              retryLabel={t('mobile.adminHome.retry')}
              onRetry={() => void query.refetch()}
            />
          ) : query.isLoading ? null : (
            <EmptyState
              title={t('users.emptyStaffTypes')}
              description={t('users.staffTypeHint')}
            />
          )
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <StaffTypeBoardCard
              item={item}
              onView={() => openType(item.id)}
              onDuplicate={() => duplicate(item.id)}
              onDeactivate={
                item.isActive && !item.isSystem
                  ? () => setConfirm({ type: 'deactivate', item })
                  : undefined
              }
              onDelete={!item.isSystem ? () => requestDelete(item) : undefined}
            />
          </ListItemEnter>
        )}
      />
      <ConfirmationSheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.type === 'delete' ? t('common.delete') : t('common.deactivate')}
        message={
          confirm?.type === 'delete'
            ? t('users.confirmDeleteStaffType')
            : t('users.confirmDeactivateStaffType')
        }
        confirmLabel={confirm?.type === 'delete' ? t('common.delete') : t('common.deactivate')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.type === 'delete') {
            deleteMutation.mutate(confirm.item.id, {
              onSuccess: () => {
                setConfirm(null);
                showToast({ variant: 'success', message: t('users.staffTypeDeleted') });
              },
              onError: (err) => {
                showToast({ variant: 'error', message: actionError(err) });
              },
            });
            return;
          }
          deactivateMutation.mutate(confirm.item.id, {
            onSuccess: () => {
              setConfirm(null);
              showToast({ variant: 'success', message: t('users.staffTypeDeactivated') });
            },
            onError: (err) => {
              showToast({ variant: 'error', message: actionError(err) });
            },
          });
        }}
      />
    </AppScreen>
  );
}
