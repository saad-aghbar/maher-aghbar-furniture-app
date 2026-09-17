import { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedName } from '@maher/i18n';
import { can, canAny } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { WorkflowListItem, WorkflowScope } from '@/api/modules/workflow';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { LocaleNameField } from '@/features/catalog/components/BilingualNameField';
import { useLocale } from '@/i18n';
import { resolveTrilingualName } from '@/i18n/resolveTrilingualName';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { WorkflowFloorBoard, WorkflowFloorRow } from './components/WorkflowFloorList';
import { WorkflowPageHeader } from './components/WorkflowPageHeader';
import { WorkflowScopeTouchBar } from './components/WorkflowScopeTouchBar';
import {
  useArchiveWorkflowMutation,
  useCreateWorkflowMutation,
  useWorkflowsQuery,
} from './query';
import { slugFromEnglishName } from './trilingualNames';
import { workflowScopeLabelKey } from './workflowScope';
import { isReturnWorkflowScope } from '@maher/types';
import { useSurfaceClearance } from '@/adaptive/useSurfaceClearance';

const LIST_BACK = '/(app)/(admin)/(tabs)/production' as Href;

export function WorkflowListScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const surfaceClearance = useSurfaceClearance();
  const { height: windowH } = useWindowDimensions();
  const allowed = canAny(user, ['production.workflow.read', 'production-order.update']);
  const canManage = can(user, 'production.workflow.manage');
  const listQuery = useWorkflowsQuery(allowed);
  const createMutation = useCreateWorkflowMutation();
  const archiveMutation = useArchiveWorkflowMutation();

  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<WorkflowScope | null>(null);
  const [createScope, setCreateScope] = useState<WorkflowScope>('STANDARD');
  const [deleteTarget, setDeleteTarget] = useState<WorkflowListItem | null>(null);
  const [name, setName] = useState('');
  const [translating, setTranslating] = useState(false);
  /** ScrollView `gap` can drop paddingBottom — spacer uses the requested tab-bar inset. */
  const listBottomClearance = surfaceClearance;

  const filtered = useMemo(() => {
    const rows = (listQuery.data ?? []).filter((row) =>
      scopeFilter === 'RETURN'
        ? isReturnWorkflowScope(row.scope)
        : scopeFilter
          ? (row.scope ?? 'STANDARD') === scopeFilter
          : true,
    );
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = localizedName(locale, row, row.code).toLowerCase();
      return name.includes(q) || row.code.toLowerCase().includes(q);
    });
  }, [listQuery.data, locale, query, scopeFilter]);

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

        <WorkflowScopeTouchBar value={scopeFilter} onChange={setScopeFilter} />

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
          <View style={{ gap: theme.spacing.sm }}>
            <PrimaryButton
              label={t('mobile.production.workflow.newWorkflow')}
              onPress={() => setCreateOpen(true)}
              leading={<Ionicons name="add" size={18} color={colors.onBrand} />}
              style={{ borderRadius: theme.radius.xl }}
            />
            <SecondaryButton
              label={t('mobile.production.workflow.manageStages')}
              onPress={() => {
                void haptics.selection();
                router.push('/(app)/(admin)/production/workflow/stages' as Href);
              }}
              leading={<Ionicons name="layers-outline" size={18} color={colors.brand} />}
              style={{ borderRadius: theme.radius.xl }}
            />
          </View>
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
              const scopeLabel = t(workflowScopeLabelKey(row.scope));
              const meta = active
                ? `${scopeLabel} · ${t('mobile.production.workflow.cardMeta', {
                    version: active.versionNumber,
                    stages: active._count?.nodes ?? 0,
                  })}`
                : `${scopeLabel} · ${t('mobile.production.workflow.draftVersion')}`;
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
        onClosed={() => {
          setName('');
          setCreateScope('STANDARD');
        }}
        title={t('mobile.production.workflow.newWorkflow')}
        fitContent
        maxHeight={Math.round(windowH * 0.85)}
      >
        <View style={{ gap: theme.spacing.md }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: theme.spacing.md }}
          >
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
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: colors.brand,
                  opacity: 0.55,
                  ...(isRTL ? { right: 0 } : { left: 0 }),
                }}
              />
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm + 2,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.md + 4 }
                    : { paddingLeft: theme.spacing.md + 4 }),
                  backgroundColor: colors.surfaceSecondary,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <AppText
                  variant="caption"
                  weight={locale === 'ar' ? 'medium' : 'semibold'}
                  style={{
                    flex: 1,
                    letterSpacing: locale === 'ar' ? 0 : 0.55,
                    textTransform: locale === 'ar' ? 'none' : 'uppercase',
                    fontSize: 11,
                    lineHeight: 14,
                    color: colors.brand,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {t('mobile.production.workflow.scopeSection')}
                </AppText>
              </View>
              <View
                style={{
                  padding: theme.spacing.md,
                  gap: theme.spacing.sm,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.md + 4 }
                    : { paddingLeft: theme.spacing.md + 4 }),
                }}
              >
                <View
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    padding: theme.spacing.sm,
                  }}
                >
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {t('mobile.production.workflow.newWorkflowHint')}
                  </AppText>
                </View>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.sm,
                  }}
                >
                  {([
                    ['STANDARD', t('mobile.production.workflow.scopeStandard')],
                    ['RETURN', t('mobile.production.workflow.scopeReturn')],
                  ] as const).map(([value, label]) => {
                    const selected = createScope === value;
                    return (
                      <AnimatedPressable
                        key={value}
                        variant="button"
                        onPress={() => {
                          void haptics.selection();
                          setCreateScope(value);
                        }}
                        style={{
                          flexGrow: 1,
                          minHeight: 40,
                          borderRadius: theme.radius.lg,
                          borderWidth: 1.5,
                          borderColor: selected ? colors.brand : colors.borderStrong,
                          backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
                          paddingHorizontal: theme.spacing.md,
                          justifyContent: 'center',
                          overflow: 'hidden',
                          alignItems: isRTL ? 'flex-end' : 'flex-start',
                        }}
                      >
                        {selected ? (
                          <View
                            pointerEvents="none"
                            style={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              width: 3,
                              backgroundColor: colors.brand,
                              opacity: 0.55,
                              ...(isRTL ? { right: 0 } : { left: 0 }),
                            }}
                          />
                        ) : null}
                        <AppText
                          weight={selected ? (locale === 'ar' ? 'medium' : 'semibold') : 'medium'}
                          style={{
                            color: selected ? colors.brand : colors.textPrimary,
                            textAlign: isRTL ? 'right' : 'left',
                            paddingLeft: selected && !isRTL ? 4 : 0,
                            paddingRight: selected && isRTL ? 4 : 0,
                          }}
                        >
                          {label}
                        </AppText>
                      </AnimatedPressable>
                    );
                  })}
                </View>
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.production.workflow.scopeHint')}
                </AppText>
              </View>
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
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: colors.brand,
                  opacity: 0.55,
                  ...(isRTL ? { right: 0 } : { left: 0 }),
                }}
              />
              <View
                style={{
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm + 2,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.md + 4 }
                    : { paddingLeft: theme.spacing.md + 4 }),
                  backgroundColor: colors.surfaceSecondary,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <AppText
                  variant="caption"
                  weight={locale === 'ar' ? 'medium' : 'semibold'}
                  style={{
                    letterSpacing: locale === 'ar' ? 0 : 0.55,
                    textTransform: locale === 'ar' ? 'none' : 'uppercase',
                    fontSize: 11,
                    lineHeight: 14,
                    color: colors.brand,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {t('mobile.production.workflow.namesSection')}
                </AppText>
              </View>
              <View
                style={{
                  padding: theme.spacing.md,
                  gap: theme.spacing.sm,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.md + 4 }
                    : { paddingLeft: theme.spacing.md + 4 }),
                }}
              >
                <LocaleNameField
                  value={name}
                  onChange={setName}
                  label={t('catalog.name')}
                  autoCapitalize="words"
                />
              </View>
            </View>
          </ScrollView>

          <View
            style={{
              paddingTop: theme.spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
              paddingBottom: Math.max(insets.bottom, theme.spacing.sm),
            }}
          >
            <SecondaryButton
              label={t('mobile.production.cancel')}
              onPress={() => setCreateOpen(false)}
              style={{
                flex: 1,
                borderRadius: theme.radius.full,
                minHeight: theme.sizes.touch.min,
                paddingVertical: 0,
              }}
            />
            <PrimaryButton
              label={t('mobile.production.workflow.createWorkflow')}
              loading={createMutation.isPending || translating}
              disabled={!name.trim() || createMutation.isPending || translating}
              style={{
                flex: 1.35,
                borderRadius: theme.radius.full,
                minHeight: theme.sizes.touch.min,
                paddingVertical: 0,
                ...orderBoardShadow(colorScheme),
              }}
              onPress={() => {
                void (async () => {
                  if (!name.trim() || createMutation.isPending || translating) return;
                  setTranslating(true);
                  try {
                    const names = await resolveTrilingualName(name, locale);
                    createMutation.mutate(
                      {
                        code: slugFromEnglishName(names.nameEn, 'WORKFLOW'),
                        nameEn: names.nameEn,
                        nameAr: names.nameAr,
                        nameHe: names.nameHe,
                        scope: createScope,
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
                  } finally {
                    setTranslating(false);
                  }
                })();
              }}
            />
          </View>
        </View>
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
