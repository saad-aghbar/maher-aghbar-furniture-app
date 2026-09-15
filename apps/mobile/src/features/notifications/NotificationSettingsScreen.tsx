import { useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { queryKeys } from '@/api/queryKeys';
import {
  getNotificationTopics,
  putNotificationPreferences,
  type NotificationTopicRow,
} from '@/api/modules/notifications';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { FloorCheckGroup, FloorCheckRow } from '@/components/floor/FloorCheckGroup';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter, useReducedMotion } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { getStoredPushToken } from '@/storage/pushDevice';
import { groupLocalizedNotificationTopics } from './selectNotificationPrefs';
import { registerPushDevice } from './registerPushDevice';

type Props = {
  backFallback: Href;
};

export function NotificationSettingsScreen({ backFallback }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const qc = useQueryClient();
  const { showToast } = useToast();
  const allowed = can(user, 'notification.read');
  const leadSize = theme.sizes.touch.min;
  const dockPad =
    stickyCtaBottomInset(insets.bottom, theme.spacing.md, SURFACE_TAB_BAR_CLEARANCE) + 88;

  const query = useQuery({
    queryKey: queryKeys.notifications.topics(),
    queryFn: async () => getNotificationTopics(await getStoredPushToken()),
    enabled: allowed,
  });

  const [draft, setDraft] = useState<{
    topics: NotificationTopicRow[];
    pushEnabled: boolean;
    masterEnabled: boolean;
  } | null>(null);

  if (query.data && !draft) {
    setDraft({
      topics: query.data.topics,
      masterEnabled: query.data.masterEnabled,
      pushEnabled: query.data.device?.pushEnabled ?? true,
    });
  }

  const topics = draft?.topics ?? query.data?.topics ?? [];
  const pushEnabled = draft?.pushEnabled ?? query.data?.device?.pushEnabled ?? true;
  const masterEnabled = draft?.masterEnabled ?? query.data?.masterEnabled ?? true;

  const grouped = useMemo(
    () => groupLocalizedNotificationTopics(topics, query.data?.groups ?? [], locale),
    [locale, query.data?.groups, topics],
  );

  const save = useMutation({
    mutationFn: async () => {
      const token = await getStoredPushToken();
      return putNotificationPreferences({
        masterEnabled,
        topics: Object.fromEntries(topics.map((row) => [row.code, row.enabled])),
        device: token ? { token, pushEnabled } : undefined,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.notifications.topics() });
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.notifications.prefs.saved') });
      router.back();
    },
    onError: (err) => {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.notifications.prefs.saveFailed'),
      });
    },
  });

  const osDenied = query.data?.device?.osPermission === 'denied';

  if (!allowed) {
    return (
      <AppScreen>
        <ScreenBackLead fallback={backFallback} />
        <AppText variant="body" color="muted">
          {t('mobile.notifications.prefs.empty')}
        </AppText>
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen>
        <ScreenBackLead fallback={backFallback} />
        <ErrorState
          title={t('mobile.notifications.errorTitle')}
          description={t('mobile.notifications.errorBody')}
          retryLabel={t('mobile.notifications.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!query.data) {
    return (
      <AppScreen>
        <ScreenBackLead fallback={backFallback} />
        <AppText variant="body" color="muted">
          {t('mobile.notifications.loading')}
        </AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={{ top: true, bottom: false }} padding="lg">
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
          <ScreenBackLead fallback={backFallback} />
        </View>
        <AppText
          variant="largeTitle"
          weight={titleWeight}
          align="center"
          numberOfLines={2}
          style={{
            paddingHorizontal: leadSize + theme.spacing.sm,
          }}
        >
          {t('mobile.notifications.prefs.title')}
        </AppText>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: dockPad,
        }}
      >
        <AppText variant="caption" color="muted" weight="regular">
          {t('mobile.notifications.prefs.subtitle')}
        </AppText>

        <ListItemEnter index={0} enabled={!reduce}>
          <ToggleBoard
            label={t('mobile.notifications.prefs.deliverToPhone')}
            hint={t('mobile.notifications.prefs.deliverToPhoneHint')}
            checked={pushEnabled}
            isRTL={isRTL}
            titleWeight={titleWeight}
            onToggle={() => {
              void haptics.selection();
              setDraft((prev) =>
                prev ? { ...prev, pushEnabled: !prev.pushEnabled } : prev,
              );
            }}
          />
        </ListItemEnter>

        <ListItemEnter index={1} enabled={!reduce}>
          <ToggleBoard
            label={t('mobile.notifications.prefs.pauseAll')}
            hint={t('mobile.notifications.prefs.pauseAllHint')}
            checked={!masterEnabled}
            isRTL={isRTL}
            titleWeight={titleWeight}
            onToggle={() => {
              void haptics.selection();
              setDraft((prev) =>
                prev ? { ...prev, masterEnabled: !prev.masterEnabled } : prev,
              );
            }}
          />
        </ListItemEnter>

        {osDenied ? (
          <AnimatedPressable
            variant="button"
            onPress={() => {
              void haptics.selection();
              if (Platform.OS === 'ios' || Platform.OS === 'android') void Linking.openSettings();
              else void registerPushDevice(user);
            }}
            style={{
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.brand,
              backgroundColor: colors.brandSoft,
              paddingHorizontal: theme.spacing.lg,
              justifyContent: 'center',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <AppText variant="label" weight={titleWeight} style={{ color: colors.brand }}>
              {t('mobile.notifications.prefs.openSettings')}
            </AppText>
          </AnimatedPressable>
        ) : null}

        {topics.length === 0 ? (
          <AppText variant="body" color="muted">
            {t('mobile.notifications.prefs.empty')}
          </AppText>
        ) : (
          grouped.map((group, groupIndex) => {
            const allOn = group.rows.every((row) => row.enabled);
            return (
              <ListItemEnter key={group.id} index={groupIndex + 2} enabled={!reduce}>
                <FloorCheckGroup
                  title={group.name}
                  actionLabel={
                    allOn
                      ? t('mobile.notifications.prefs.groupNone')
                      : t('mobile.notifications.prefs.groupAll')
                  }
                  onAction={() => {
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            topics: prev.topics.map((row) =>
                              row.group === group.id ? { ...row, enabled: !allOn } : row,
                            ),
                          }
                        : prev,
                    );
                  }}
                >
                  {group.rows.map((row) => (
                    <FloorCheckRow
                      key={row.code}
                      label={row.name}
                      hint={row.hint}
                      checked={row.enabled}
                      onToggle={() => {
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                topics: prev.topics.map((item) =>
                                  item.code === row.code
                                    ? { ...item, enabled: !item.enabled }
                                    : item,
                                ),
                              }
                            : prev,
                        );
                      }}
                    />
                  ))}
                </FloorCheckGroup>
              </ListItemEnter>
            );
          })
        )}
      </ScrollView>

      <FloatingActionDock>
        <PrimaryButton
          label={t('mobile.notifications.prefs.confirm')}
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={save.isPending}
          style={{
            borderRadius: theme.radius.full,
            minHeight: theme.sizes.touch.min,
            paddingVertical: 0,
          }}
        />
      </FloatingActionDock>
    </AppScreen>
  );
}

function ToggleBoard({
  label,
  hint,
  checked,
  isRTL,
  titleWeight,
  onToggle,
}: {
  label: string;
  hint: string;
  checked: boolean;
  isRTL: boolean;
  titleWeight: 'medium' | 'semibold';
  onToggle: () => void;
}) {
  const { colors, theme, colorScheme } = useTheme();
  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: checked ? colors.borderStrong : colors.border,
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
          backgroundColor: checked ? colors.brand : colors.border,
          opacity: checked ? 0.7 : 0.35,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          ...(isRTL ? { paddingRight: theme.spacing.lg + 4 } : { paddingLeft: theme.spacing.lg + 4 }),
          gap: 4,
        }}
      >
        <AppText variant="label" weight={titleWeight}>
          {label}
        </AppText>
        <AppText variant="caption" color="muted" weight="regular">
          {hint}
        </AppText>
      </View>
    </AnimatedPressable>
  );
}
