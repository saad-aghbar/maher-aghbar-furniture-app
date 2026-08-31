import { useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { can } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import type { Supplier } from '@/api/modules/purchasing';
import { toastMessageForError } from '@/api/queryClient';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { CreateSupplierSheet } from './components/CreateSupplierSheet';
import { SupplierBoardCard } from './components/SupplierBoardCard';
import { useArchiveSupplierMutation, useSuppliersQuery } from './query';

const BACK_FALLBACK = '/(app)/(admin)/purchasing' as Href;

function SuppliersScreenTitle({ titleWeight }: { titleWeight: 'medium' | 'semibold' }) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ position: 'relative', minHeight: leadSize, justifyContent: 'center' }}>
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
        <ScreenBackLead fallback={BACK_FALLBACK} />
      </View>
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
      >
        {t('mobile.purchasing.suppliersTitle')}
      </AppText>
    </View>
  );
}

/**
 * Suppliers list — parchment boards with search, add, edit, soft-archive.
 */
export function SuppliersListScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const listBottomPad = insets.bottom + SURFACE_TAB_BAR_CLEARANCE;
  const allowed = can(user, 'supplier.read');
  const canManage = can(user, 'supplier.manage');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 280);
    return () => clearTimeout(id);
  }, [q]);

  const query = useSuppliersQuery(allowed, debouncedQ || undefined);
  const archiveMutation = useArchiveSupplierMutation();

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditing(null);
  };

  const runArchive = async () => {
    if (!confirmDelete) return;
    try {
      await archiveMutation.mutateAsync(confirmDelete.id);
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('mobile.purchasing.supplierDeleted') });
      setConfirmDelete(null);
    } catch (err) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.purchasing.createFailed'),
      });
    }
  };

  if (!allowed) {
    return (
      <ScrollableScreen>
        <SuppliersScreenTitle titleWeight={titleWeight} />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </ScrollableScreen>
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <ScrollableScreen>
        <SuppliersScreenTitle titleWeight={titleWeight} />
        <AppText variant="body" color="secondary">
          {t('mobile.loadingSession')}
        </AppText>
      </ScrollableScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <ScrollableScreen>
        <SuppliersScreenTitle titleWeight={titleWeight} />
        <ErrorState
          title={t('mobile.purchasing.errorTitle')}
          description={t('mobile.purchasing.errorBody')}
          retryLabel={t('mobile.purchasing.retry')}
          onRetry={() => void query.refetch()}
        />
      </ScrollableScreen>
    );
  }

  const rows = query.data?.data ?? [];

  return (
    <ScrollableScreen
      scrollProps={{
        keyboardShouldPersistTaps: 'handled',
        refreshControl: (
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        ),
      }}
    >
      <SuppliersScreenTitle titleWeight={titleWeight} />
      {showOfflineBanner ? <OfflineBanner /> : null}

      <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.purchasing.suppliersHint')}
        </AppText>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'stretch',
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <TextField
            value={q}
            onChangeText={setQ}
            placeholder={t('mobile.purchasing.searchSuppliers')}
            returnKeyType="search"
            pill
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
        {canManage ? (
          <PrimaryButton
            label={t('mobile.purchasing.addSupplier')}
            onPress={() => {
              void haptics.selection();
              openCreate();
            }}
            style={{
              borderRadius: theme.radius.full,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: 0,
              minHeight: theme.sizes.touch.min,
              alignSelf: 'stretch',
            }}
          />
        ) : null}
      </View>

      {rows.length === 0 ? (
        <EmptyState
          title={
            debouncedQ
              ? t('mobile.purchasing.noSuppliersMatch')
              : t('mobile.purchasing.noSuppliers')
          }
          description={
            debouncedQ ? undefined : t('mobile.purchasing.noSuppliersBody')
          }
        />
      ) : (
        <View
          style={{
            gap: theme.spacing.lg,
            marginTop: theme.spacing.md,
            paddingBottom: listBottomPad,
          }}
        >
          {rows.map((supplier, index) => (
            <ListItemEnter key={supplier.id} index={index}>
              <SupplierBoardCard
                supplier={supplier}
                onEdit={canManage ? () => openEdit(supplier) : undefined}
                onDelete={canManage ? () => setConfirmDelete(supplier) : undefined}
              />
            </ListItemEnter>
          ))}
        </View>
      )}

      {canManage ? (
        <CreateSupplierSheet
          open={sheetOpen}
          onClose={closeSheet}
          mode={editing ? 'edit' : 'create'}
          supplier={editing}
        />
      ) : null}

      <ConfirmationSheet
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={t('mobile.purchasing.deleteSupplier')}
        message={t('mobile.purchasing.deleteSupplierConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void runArchive()}
      />
    </ScrollableScreen>
  );
}
