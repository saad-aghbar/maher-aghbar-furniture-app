import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  notificationIconFor,
  type NotificationCardModel,
} from '../selectNotification';
import {
  NOTIFICATION_LTR_TREE,
  notificationLeadEdge,
  notificationRowDirection,
  notificationStartAlign,
  notificationStartBandPad,
} from '../notificationLayout';

type Props = {
  item: NotificationCardModel;
  onPress: () => void;
};

/**
 * Notification floor card — soft board, unread accent, type icon band.
 */
export function NotificationBoardCard({ item, onPress }: Props) {
  const { t, isRTL, locale, formatDateTime } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const icon = notificationIconFor(item.type, item.linkUrl);
  const hasLink = Boolean(item.linkUrl);

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.body}`}
      accessibilityState={{ selected: item.unread }}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: item.unread ? colors.brand : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...NOTIFICATION_LTR_TREE,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...notificationLeadEdge(isRTL),
          width: 3,
          backgroundColor: item.unread ? colors.brand : colors.textMuted,
          opacity: item.unread ? 0.65 : 0.28,
        }}
      />

      <View
        style={{
          flexDirection: notificationRowDirection(isRTL),
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm + 2,
          ...notificationStartBandPad(isRTL, theme.spacing.lg + 4),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <View
          style={{
            flexDirection: notificationRowDirection(isRTL),
            alignItems: 'center',
            gap: theme.spacing.sm,
            flex: 1,
            minWidth: 0,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: item.unread ? colors.brandSoft : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons
              name={icon}
              size={14}
              color={item.unread ? colors.brand : colors.textSecondary}
            />
          </View>
          <AppText
            variant="caption"
            weight={item.unread ? titleWeight : 'medium'}
            color={item.unread ? 'brand' : 'muted'}
            align="start"
            numberOfLines={1}
            style={{
              flexShrink: 1,
              letterSpacing: locale === 'ar' ? 0 : 0.45,
              fontSize: 11,
            }}
          >
            {item.unread ? t('mobile.notifications.unread') : t('mobile.notifications.read')}
          </AppText>
        </View>

        <AppText
          variant="caption"
          color="muted"
          align="end"
          numberOfLines={1}
          style={{ flexShrink: 0, fontSize: 11 }}
        >
          {formatDateTime(item.createdAt)}
        </AppText>
      </View>

      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.sm,
          ...notificationStartBandPad(isRTL, theme.spacing.lg + 4),
        }}
      >
        <AppText
          variant="label"
          weight={titleWeight}
          align="start"
          numberOfLines={2}
          style={{
            width: '100%',
            textAlign: notificationStartAlign(isRTL),
            fontSize: 16,
            lineHeight: 22,
          }}
        >
          {item.title}
        </AppText>
        {item.body ? (
          <AppText
            variant="caption"
            color="secondary"
            align="start"
            numberOfLines={3}
            style={{
              width: '100%',
              textAlign: notificationStartAlign(isRTL),
              lineHeight: 18,
              fontSize: 13,
            }}
          >
            {item.body}
          </AppText>
        ) : null}

        {hasLink ? (
          <AppText
            variant="caption"
            color="brand"
            weight="semibold"
            align="start"
            style={{
              width: '100%',
              alignSelf: 'stretch',
              textAlign: notificationStartAlign(isRTL),
              marginTop: 2,
              fontSize: 12,
            }}
          >
            {t('mobile.notifications.openHint')}
          </AppText>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}
