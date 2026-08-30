import { useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedName } from '@maher/i18n';
import { can, canAny } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { StageDefinition } from '@/api/modules/workflow';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { WorkflowPageHeader } from './components/WorkflowPageHeader';
import { useCreateStageMutation, useStageLibraryQuery } from './query';
import {
  groupStageLibrary,
  isLockedOpeningStage,
  stageLibraryListInset,
} from './selectStageLibrary';
import { nameFieldOrder, slugFromEnglishName, type TrilingualNames } from './trilingualNames';

const STAGES_BACK = '/(app)/(admin)/production/workflow' as Href;

function StageGroupKicker({ label }: { label: string }) {
  const { locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText
        variant="caption"
        weight={locale === 'ar' ? 'regular' : 'medium'}
        style={{
          color: colors.brand,
          textTransform: 'none',
          letterSpacing: locale === 'ar' ? 0 : 0.6,
          fontSize: 12,
        }}
      >
        {label}
      </AppText>
      <View
        style={{
          width: 28,
          height: 2,
          borderRadius: 1,
          backgroundColor: colors.brand,
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
        }}
      />
    </View>
  );
}

function StageLibraryCard({
  stage,
  index,
}: {
  stage: StageDefinition;
  index: number;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const locked = isLockedOpeningStage(stage);
  const name = localizedName(locale, stage, stage.code);
  const icon: keyof typeof Ionicons.glyphMap = locked ? 'layers-outline' : 'people-outline';

  return (
    <ListItemEnter index={index}>
      <View
        accessibilityLabel={name}
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
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name={icon} size={18} color={colors.textSecondary} />
            </View>
            {stage.requiresPhotos ? (
              <View
                style={{
                  marginTop: -8,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="camera-outline" size={12} color={colors.textMuted} />
              </View>
            ) : null}
          </View>

          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            {locked ? (
              <AppText
                variant="caption"
                weight={locale === 'ar' ? 'regular' : 'medium'}
                style={{
                  color: colors.brand,
                  textTransform: 'none',
                  letterSpacing: locale === 'ar' ? 0 : 0.5,
                  fontSize: 11,
                }}
              >
                {t('mobile.production.workflow.alwaysFirst')}
              </AppText>
            ) : null}
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {name}
            </AppText>
          </View>

          {locked ? (
            <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
          ) : (
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={16}
              color={colors.textMuted}
            />
          )}
        </View>
      </View>
    </ListItemEnter>
  );
}

export function StageLibraryScreen() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const allowed = canAny(user, [
    'production.workflow.read',
    'production-order.update',
    'production.workflow.manage',
    'production.workflow.stage.manage',
  ]);
  const canManage = can(user, 'production.workflow.stage.manage') || can(user, 'production.workflow.manage');
  const listQuery = useStageLibraryQuery(allowed);
  const createMutation = useCreateStageMutation();

  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [names, setNames] = useState<TrilingualNames>({
    nameEn: '',
    nameAr: '',
    nameHe: '',
  });

  const fieldOrder = nameFieldOrder(locale);
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

  const groups = useMemo(() => groupStageLibrary(filtered), [filtered]);
  const listBottomClearance = stageLibraryListInset(insets.bottom, SURFACE_TAB_BAR_CLEARANCE);

  if (!allowed) return null;

  return (
    <>
      <AppScreen>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.spacing.lg, flexGrow: 1 }}
        >
          {showOfflineBanner ? <OfflineBanner /> : null}

          <WorkflowPageHeader
            fallback={STAGES_BACK}
            title={t('mobile.production.workflow.manageStages')}
            subtitle={t('mobile.production.workflow.manageStagesSubtitle')}
          />

          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder={t('mobile.production.workflow.searchStages')}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />

          {canManage ? (
            <PrimaryButton
              label={t('mobile.production.workflow.createStage')}
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
            <EmptyState title={t('mobile.production.workflow.emptyStages')} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={t('mobile.production.workflow.noStagesMatch')}
              description={t('mobile.production.workflow.searchStages')}
            />
          ) : (
            <View style={{ gap: theme.spacing.xl }}>
              {groups.opening.length > 0 ? (
                <View style={{ gap: theme.spacing.md }}>
                  <View style={{ gap: theme.spacing.xs }}>
                    <StageGroupKicker label={t('mobile.production.workflow.openingGroup')} />
                    <AppText variant="caption" color="muted">
                      {t('mobile.production.workflow.openingGroupHint')}
                    </AppText>
                  </View>
                  {groups.opening.map((stage, index) => (
                    <StageLibraryCard key={stage.id} stage={stage} index={index} />
                  ))}
                </View>
              ) : null}

              {groups.production.length > 0 ? (
                <View style={{ gap: theme.spacing.md }}>
                  <StageGroupKicker label={t('mobile.production.workflow.productionGroup')} />
                  {groups.production.map((stage, index) => (
                    <StageLibraryCard
                      key={stage.id}
                      stage={stage}
                      index={groups.opening.length + index}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          )}

          {/* ScrollView `gap` can drop paddingBottom — spacer is the last-card inset. */}
          <View style={{ height: listBottomClearance }} />
        </ScrollView>
      </AppScreen>

      <BottomSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onClosed={() => setNames({ nameEn: '', nameAr: '', nameHe: '' })}
        title={t('mobile.production.workflow.createStage')}
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
            label={t('mobile.production.workflow.createStage')}
            loading={createMutation.isPending}
            disabled={!names.nameEn.trim() || !names.nameAr.trim()}
            style={{ borderRadius: theme.radius.xl }}
            onPress={() => {
              createMutation.mutate(
                {
                  code: slugFromEnglishName(names.nameEn, 'STAGE'),
                  nameEn: names.nameEn.trim(),
                  nameAr: names.nameAr.trim(),
                  nameHe: names.nameHe.trim() || undefined,
                },
                {
                  onSuccess: () => {
                    setCreateOpen(false);
                    void haptics.confirmLight();
                    showToast({
                      variant: 'success',
                      message: t('mobile.production.workflow.stageAdded'),
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
                },
              );
            }}
          />
        </ScrollView>
      </BottomSheet>
    </>
  );
}
