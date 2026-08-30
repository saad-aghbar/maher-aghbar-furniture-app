import { type ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { AppText } from '@/components/AppText';
import { HomeWatermark } from '@/components/chrome/HomeWatermark';
import { NotificationBellButton } from '@/components/chrome/NotificationBellButton';
import { ExpandableLocaleSwitcher } from '@/components/ExpandableLocaleSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

export function greetingPeriod(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

type Props = {
  estLine: string;
  greetingLead: string;
  name: string;
  welcome?: string;
  unreadNotifications: number;
  canOpenNotifications: boolean;
  notificationsA11y: string;
  onNotificationsPress: () => void;
  /** Extra row under the welcome (search, whisper). */
  children?: ReactNode;
  showWatermark?: boolean;
};

/**
 * Shared home hero — EST. 1995, greeting, faint M, circular chrome.
 * Admin living hero keeps its own motion; dealer / worker compose this.
 */
export function HomeHeroHeader({
  estLine,
  greetingLead,
  name,
  welcome,
  unreadNotifications,
  canOpenNotifications,
  notificationsA11y,
  onNotificationsPress,
  children,
  showWatermark = true,
}: Props) {
  const { isRTL, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { width } = useWindowDimensions();
  const ink = colorScheme === 'dark' ? colors.textPrimary : '#2A2420';

  return (
    <View
      style={{
        gap: theme.spacing.md,
        marginBottom: theme.spacing.md,
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {showWatermark ? <HomeWatermark /> : null}

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 20,
        }}
      >
        <AppText
          variant="caption"
          weight="medium"
          style={{ letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textMuted }}
        >
          {formatDate(new Date())}
        </AppText>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.xs,
            alignItems: 'center',
          }}
        >
          <ExpandableLocaleSwitcher expandToward="end" />
          <ThemeSwitcher />
          {canOpenNotifications ? (
            <NotificationBellButton
              unread={unreadNotifications}
              accessibilityLabel={notificationsA11y}
              onPress={onNotificationsPress}
            />
          ) : null}
        </View>
      </View>

      <View
        style={{
          zIndex: 2,
          gap: theme.spacing.sm,
          alignItems: isRTL ? 'flex-end' : 'flex-start',
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          style={{
            color: colors.brand,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          {estLine}
        </AppText>
        <AppText
          variant="largeTitle"
          style={{
            color: ink,
            fontSize: 36,
            lineHeight: 42,
            letterSpacing: -1,
            maxWidth: width * 0.82,
          }}
        >
          {greetingLead}
        </AppText>
        {name ? (
          <AppText
            variant="largeTitle"
            numberOfLines={2}
            style={{
              color: ink,
              fontSize: 36,
              lineHeight: 42,
              letterSpacing: -1,
              maxWidth: width * 0.82,
            }}
          >
            {name}
          </AppText>
        ) : null}
        {welcome ? (
          <AppText
            variant="body"
            style={{
              color: colors.textSecondary,
              maxWidth: width * 0.72,
              marginTop: theme.spacing.xs,
            }}
          >
            {welcome}
          </AppText>
        ) : null}
      </View>

      {children}
    </View>
  );
}
