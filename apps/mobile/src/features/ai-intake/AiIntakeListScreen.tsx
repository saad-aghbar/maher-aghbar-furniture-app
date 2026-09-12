import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { uploadFile } from '@/api/modules/uploads';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ActionSheet, type ActionSheetItem } from '@/components/sheets/ActionSheet';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useLocale } from '@/i18n';
import { ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useState } from 'react';
import { flattenAiJobsPages, useAiJobsInfiniteQuery, useCreateAiJobMutation } from './query';
import { aiIntakeListBadgeStatus, selectAiJobReview } from './selectAiReview';

export function AiIntakeListScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const allowed = can(user, 'ai-intake.read');
  const canManage = can(user, 'ai-intake.manage');

  const query = useAiJobsInfiniteQuery(allowed);
  const createMutation = useCreateAiJobMutation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const items = flattenAiJobsPages(query.data);

  async function startFromUri(uri: string, fileName: string, mimeType: string) {
    setUploading(true);
    try {
      const uploaded = await uploadFile({
        uri,
        fileName,
        mimeType,
        category: 'AI_INTAKE',
      });
      const sourceType = mimeType.startsWith('image/') ? 'IMAGE' : 'PDF';
      const job = await createMutation.mutateAsync({
        sourceType,
        storageKey: uploaded.document.storageKey,
      });
      void haptics.confirmMedium();
      router.push(`/(app)/(admin)/ai-intake/${job.id}` as Href);
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.aiIntake.uploadFailed') });
    } finally {
      setUploading(false);
    }
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    await startFromUri(
      a.uri,
      a.fileName ?? `ai-intake-${Date.now()}.jpg`,
      a.mimeType ?? 'image/jpeg',
    );
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    await startFromUri(a.uri, a.name, a.mimeType ?? 'application/pdf');
  }

  const actions: ActionSheetItem[] = [
    {
      label: t('mobile.aiIntake.pickImage'),
      icon: 'images-outline',
      deferUntilClosed: true,
      onPress: () => void pickImage(),
    },
    {
      label: t('mobile.aiIntake.pickDocument'),
      icon: 'document-outline',
      deferUntilClosed: true,
      onPress: () => void pickDocument(),
    },
  ];

  if (!allowed) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)' as Href}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)' as Href}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.aiIntake.errorTitle')}
          description={t('mobile.aiIntake.errorBody')}
          retryLabel={t('mobile.aiIntake.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={'/(app)/(admin)/ai-intake' as Href} edges={{ top: true, bottom: false }}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
        contentContainerStyle={{ paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
            <AppText variant="title" weight="semibold">
              {t('mobile.aiIntake.title')}
            </AppText>
            <AppText variant="bodySecondary" color="secondary">
              {t('mobile.aiIntake.subtitle')}
            </AppText>
            {canManage ? (
              <PrimaryButton
                label={t('mobile.aiIntake.newUpload')}
                onPress={() => setSheetOpen(true)}
                loading={uploading || createMutation.isPending}
                style={{ minHeight: theme.sizes.touch.min }}
              />
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => {
          const review = selectAiJobReview(item);
          return (
            <ListItemEnter index={index}>
              <Pressable
                onPress={() => {
                  void haptics.selection();
                  router.push(`/(app)/(admin)/ai-intake/${item.id}` as Href);
                }}
                style={{ marginBottom: theme.spacing.md }}
              >
                <SurfaceCard style={{ gap: theme.spacing.sm, minHeight: theme.sizes.touch.min * 2 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <AppText variant="heading" weight="semibold" style={{ flex: 1 }}>
                      {item.number}
                    </AppText>
                    <StatusBadge
                      status={aiIntakeListBadgeStatus(item.status, review?.phase)}
                      label={
                        review
                          ? t(`mobile.aiIntake.phases.${review.phase}`)
                          : item.status
                      }
                    />
                  </View>
                  <AppText variant="bodySecondary" color="secondary" numberOfLines={1}>
                    {review?.extractedModel ?? t('mobile.aiIntake.noModelYet')}
                  </AppText>
                </SurfaceCard>
              </Pressable>
            </ListItemEnter>
          );
        }}
        ListEmptyComponent={
          query.isLoading ? (
            <AppText color="muted">{t('mobile.aiIntake.loading')}</AppText>
          ) : (
            <EmptyState
              title={t('mobile.aiIntake.emptyTitle')}
              description={t('mobile.aiIntake.emptyBody')}
              actionLabel={canManage ? t('mobile.aiIntake.newUpload') : undefined}
              onAction={canManage ? () => setSheetOpen(true) : undefined}
            />
          )
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
      />
      <ActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('mobile.aiIntake.newUpload')}
        actions={actions}
        cancelLabel={t('mobile.aiIntake.cancel')}
      />
    </AppScreen>
  );
}
