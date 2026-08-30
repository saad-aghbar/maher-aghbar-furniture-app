import { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedName } from '@maher/i18n';
import { can, canAny } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { WorkflowListItem } from '@/api/modules/workflow';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { useLocale } from '@/i18n';
import { ListItemEnter, haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { WorkflowFloorBoard, WorkflowFloorRow } from './components/WorkflowFloorList';
import { WorkflowPageHeader } from './components/WorkflowPageHeader';
import {
  useArchiveWorkflowMutation,
  useCreateWorkflowMutation,
  useWorkflowsQuery,
} from './query';
import { nameFieldOrder, slugFromEnglishName, type TrilingualNames } from './trilingualNames';

const LIST_BACK = '/(app)/(admin)/(tabs)/production' as Href;

export function WorkflowListScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const allowed = canAny(user, ['production.workflow.read', 'production-order.update']);
  const canManage = can(user, 'production.workflow.manage');
  const listQuery = useWorkflowsQuery(allowed);
  const createMutation = useCreateWorkflowMutation();
  const archiveMutation = useArchiveWorkflowMutation();

  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowListItem | null>(null);
  const [names, setNames] = useState<TrilingualNames>({
    nameEn: '',
    nameAr: '',
    nameHe: '',
  });

  const fieldOrder = nameFieldOrder(locale);
  /** ScrollView `gap` can drop paddingBottom — spacer uses the requested tab-bar inset. */
  const listBottomClearance = insets.bottom + SURFACE_TAB_BAR_CLEARANCE;
  const nameLabels: Record<keyof TrilingualNames, string> = {
    nameEn: t('mobile.production.workflow.nameEn'),
    nameAr: t('mobile.production.workflow.nameAr'),
    nameHe: t('mobile.production.workflow.nameHe'),
  };

  const filtered = useMemo(() => {
    const rows = listQuery.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = localizedName(locale, row, row.code).toLowerCase();
      return name.includes(q) || row.code.toLowerCase().includes(q);
    });
  }, [listQuery.data, locale, query]);

  if (!allowed) return null;

  return (
    <>
      <ScrollableScreen contentContainerStyle={{ paddingBottom: 0 }}>
        {showOfflineBanner ? <OfflineBanner /> : null}

        <WorkflowPageHeader
          fallback={LIST_BACK}
          title={t('mobile.production.workflow.title')}
          subtitle={t('mobile.production.workflow.simpleSubtitle')}
        />

        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t('mobile.production.workflow.searchWorkflows')}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        {canManage ? (
          <PrimaryButton
            label={t('mobile.production.workflow.newWorkflow')}
            onPress={() => setCreateOpen(true)}
            leading={<Ionicons name="add" size={18} color={colors.onBrand} />}
            style={{ borderRadius: theme.radius.xl }}
          />
        ) : null}

        {listQuery.isLoading ? (
          <AppText color="secondary">{t('mobile.production.loadingMore')}</AppText>
        ) : listQuery.isError ? (
          <ErrorState
            title={t('mobile.production.workflow.loadError')}
            description={t('mobile.production.workflow.retry')}
            retryLabel={t('mobile.production.workflow.retry')}
            onRetry={() => void listQuery.refetch()}
          />
        ) : (listQuery.data ?? []).length === 0 ? (
          <EmptyState
            title={t('mobile.production.workflow.emptyWorkflow')}
            description={t('mobile.production.workflow.emptyWorkflowHint')}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t('mobile.production.workflow.noWorkflowMatches')}
            description={t('mobile.production.workflow.searchWorkflows')}
          />
        ) : (
          <WorkflowFloorBoard
            title={t('mobile.production.workflow.title')}
            count={filtered.length}
          >
            {filtered.map((row, index) => {
              const name = localizedName(locale, row, row.code);
              const active = row.activeVersion;
              const meta = active
                ? t('mobile.production.workflow.cardMeta', {
                    version: active.versionNumber,
                    stages: active._count?.nodes ?? 0,
                  })
                : t('mobile.production.workflow.draftVersion');
              return (
                <ListItemEnter key={row.id} index={index}>
                  <WorkflowFloorRow
                    label={name}
                    meta={meta}
                    icon="git-network-outline"
                    showChevron={!canManage}
                    onPress={() => {
                      void haptics.selection();
                      router.push(`/(app)/(admin)/production/workflow/${row.id}` as Href);
                    }}
                    trailing={
                      canManage ? (
                        <View
                          style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            gap: theme.spacing.sm,
                            flexShrink: 0,
                          }}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('mobile.production.workflow.deleteWorkflow')}
                            hitSlop={10}
                            onPress={() => {
                              void haptics.selection();
                              setDeleteTarget(row);
                            }}
                            style={{
                              minWidth: theme.sizes.touch.min - 8,
                              minHeight: theme.sizes.touch.min - 8,
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.error} />
                          </Pressable>
                          <Ionicons
                            name={isRTL ? 'chevron-back' : 'chevron-forward'}
                            size={16}
                            color={colors.textMuted}
                          />
                        </View>
                      ) : null
                    }
                  />
                </ListItemEnter>
              );
            })}
          </WorkflowFloorBoard>
        )}
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ height: listBottomClearance }}
        />
      </ScrollableScreen>

      <BottomSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onClosed={() =>
          setNames({ nameEn: '', nameAr: '', nameHe: '' })
        }
        title={t('mobile.production.workflow.newWorkflow')}
        fitContent
        maxHeight={Math.round(windowH * 0.85)}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: insets.bottom + theme.spacing['3xl'],
          }}
        >
          <AppText variant="caption" color="muted">
            {t('mobile.production.workflow.newWorkflowHint')}
          </AppText>
          {fieldOrder.map((key) => (
            <TextField
              key={key}
              label={nameLabels[key]}
              value={names[key]}
              onChangeText={(v) => setNames((n) => ({ ...n, [key]: v }))}
              autoCapitalize={key === 'nameEn' ? 'words' : 'none'}
            />
          ))}
          <PrimaryButton
            label={t('mobile.production.workflow.createWorkflow')}
            loading={createMutation.isPending}
            disabled={!names.nameEn.trim() || !names.nameAr.trim() || !names.nameHe.trim()}
            style={{ borderRadius: theme.radius.xl }}
            onPress={() => {
              createMutation.mutate(
                {
                  code: slugFromEnglishName(names.nameEn, 'WORKFLOW'),
                  nameEn: names.nameEn.trim(),
                  nameAr: names.nameAr.trim(),
                  nameHe: names.nameHe.trim(),
                },
                {
                  onSuccess: (created) => {
                    setCreateOpen(false);
                    void haptics.confirmLight();
                    router.push(`/(app)/(admin)/production/workflow/${created.id}` as Href);
                  },
                  onError: (err) => {
                    void haptics.error();
                    showToast({
                      variant: 'error',
                      message: isApiError(err)
                        ? toastMessageForError(err)
                        : t('mobile.production.workflow.loadError'),
                    });
                  },
                },
              );
            }}
          />
        </ScrollView>
      </BottomSheet>

      <ConfirmationSheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t('mobile.production.workflow.deleteWorkflow')}
        message={t('mobile.production.workflow.deleteWorkflowConfirm', {
          name: deleteTarget
            ? localizedName(locale, deleteTarget, deleteTarget.code)
            : '',
        })}
        confirmLabel={t('mobile.production.workflow.deleteWorkflow')}
        destructive
        onConfirm={() => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          archiveMutation.mutate(id, {
            onSuccess: () => {
              setDeleteTarget(null);
              void haptics.confirmLight();
              showToast({
                variant: 'success',
                message: t('mobile.production.workflow.workflowDeleted'),
              });
            },
            onError: (err) => {
              void haptics.error();
              showToast({
                variant: 'error',
                message: isApiError(err)
                  ? toastMessageForError(err)
                  : t('mobile.production.workflow.loadError'),
              });
            },
          });
        }}
      />
    </>
  );
}
