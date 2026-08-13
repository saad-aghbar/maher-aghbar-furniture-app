import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { WorkerHomeNotification } from '../api';
import {
  localizedWorkerNotificationBody,
  localizedWorkerNotificationTitle,
} from '../selectWorkerHome';

/** Visible window before scrolling — keeps the home board compact. */
const LIST_MAX_HEIGHT = 280;

type WorkerNotificationsPreviewProps = {
  notifications: WorkerHomeNotification[];
  canOpenNotifications: boolean;
};

type AlertStampProps = {
  notification: WorkerHomeNotification;
  index: number;
  isRTL: boolean;
  reduce: boolean;
  onPress: () => void;
};

function AlertStamp({ notification, index, isRTL, reduce, onPress }: AlertStampProps) {
  const { t, formatDateTime, locale } = useLocale();
  const { colors, theme } = useTheme();
  const unread = !notification.readAt;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const title = localizedWorkerNotificationTitle(notification, locale);
  const body = localizedWorkerNotificationBody(notification, locale);

  return (
    <Animated.View
      entering={reduce ? undefined : softFadeDown(80 + Math.min(index, 6) * 18)}
    >
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${body}`}
        accessibilityState={{ selected: unread }}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: unread ? colors.brand : colors.border,
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText variant="caption" color="muted" numberOfLines={1} style={{ flexShrink: 0 }}>
            {formatDateTime(notification.createdAt)}
          </AppText>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 6,
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: unread ? colors.brand : colors.textMuted,
                opacity: unread ? 1 : 0.45,
              }}
            />
            <AppText
              variant="caption"
              weight="semibold"
              numberOfLines={1}
              style={{
                color: unread ? colors.brand : colors.textMuted,
                letterSpacing: locale === 'ar' ? 0 : 0.4,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                fontSize: 11,
              }}
            >
              {unread ? t('mobile.notifications.unread') : t('mobile.notifications.read')}
            </AppText>
          </View>
        </View>

        <View style={{ gap: 4, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <AppText variant="label" weight={titleWeight} numberOfLines={2} align="start">
            {title}
          </AppText>
          {body ? (
            <AppText variant="caption" color="secondary" numberOfLines={2} align="start">
              {body}
            </AppText>
          ) : null}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

/**
 * Alerts board — same industrial tray language as Queue / Shift boards.
 */
export function WorkerNotificationsPreview({
  notifications,
  canOpenNotifications,
}: WorkerNotificationsPreviewProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();

  const href = '/(app)/(employee)/(tabs)/notifications' as Href;
  const open = () => {
    if (!canOpenNotifications) return;
    void haptics.selection();
    router.push(href);
  };

  return (
    <Animated.View
      entering={reduce ? undefined : softFadeDown(60)}
      style={{ marginBottom: theme.spacing.xl }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          overflow: 'hidden',
          ...theme.elevation.card,
        }}
      >
        <View style={{ height: 3, backgroundColor: colors.brand, opacity: 0.35 }} />

        <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          <Animated.View
            entering={reduce ? undefined : softFadeDown(80)}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
            }}
          >
            {canOpenNotifications ? (
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.workerHome.seeDetails')}
                onPress={open}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: theme.spacing.sm + 2,
                  paddingVertical: 8,
                  borderRadius: theme.radius.full,
                  borderWidth: 1,
                  borderColor: colors.brand,
                  backgroundColor: colors.brandSoft,
                  flexShrink: 0,
                }}
              >
                <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                  {t('mobile.workerHome.seeDetails')}
                </AppText>
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={14}
                  color={colors.brand}
                />
              </AnimatedPressable>
            ) : (
              <View />
            )}

            <View
              style={{
                flex: 1,
                gap: 4,
                minWidth: 0,
                alignItems: 'flex-end',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                style={{
                  color: colors.brand,
                  letterSpacing: locale === 'ar' ? 0 : 1.6,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  textAlign: 'right',
                }}
              >
                {t('mobile.workerHome.notificationsEyebrow')}
              </AppText>
              <AppText variant="title" weight="semibold" style={{ textAlign: 'right' }}>
                {t('mobile.workerHome.notificationsTitle')}
              </AppText>
            </View>
          </Animated.View>

          {notifications.length === 0 ? (
            <View
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                paddingVertical: theme.spacing.xl,
                paddingHorizontal: theme.spacing.lg,
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: colors.brandSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="notifications-outline" size={22} color={colors.brand} />
              </View>
              <AppText variant="label" weight="semibold">
                {t('mobile.workerHome.notificationsEmpty')}
              </AppText>
            </View>
          ) : (
          <ScrollView
            style={{ maxHeight: LIST_MAX_HEIGHT }}
            contentContainerStyle={{ gap: theme.spacing.sm }}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            {notifications.map((n, index) => (
              <AlertStamp
                key={n.id}
                notification={n}
                index={index}
                isRTL={isRTL}
                reduce={reduce}
                onPress={open}
              />
            ))}
          </ScrollView>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
