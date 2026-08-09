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
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: item.unread ? colors.brand : colors.textMuted,
          opacity: item.unread ? 0.65 : 0.28,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
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
            numberOfLines={1}
            style={{
              flexShrink: 1,
              letterSpacing: locale === 'ar' ? 0 : 0.45,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              fontSize: 11,
            }}
          >
            {item.unread ? t('mobile.notifications.unread') : t('mobile.notifications.read')}
          </AppText>
        </View>

        <AppText
          variant="caption"
          color="muted"
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
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <AppText
          variant="label"
          weight={titleWeight}
          numberOfLines={2}
          style={{
            textAlign: isRTL ? 'right' : 'left',
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
            numberOfLines={3}
            style={{
              textAlign: isRTL ? 'right' : 'left',
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
            style={{
              textAlign: isRTL ? 'right' : 'left',
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
