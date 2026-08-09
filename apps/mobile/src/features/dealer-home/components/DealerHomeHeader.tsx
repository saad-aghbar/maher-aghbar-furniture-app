import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/buttons/IconButton';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type DealerHomeHeaderProps = {
  displayName: string;
  unreadNotifications: number;
  canOpenNotifications: boolean;
};

export function DealerHomeHeader({
  displayName,
  unreadNotifications,
  canOpenNotifications,
}: DealerHomeHeaderProps) {
  const { t, formatDate, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();

  return (
    <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <AppText variant="largeTitle" numberOfLines={2}>
            {t('mobile.dealerHome.greeting', { name: displayName })}
          </AppText>
          <AppText variant="caption" color="secondary">
            {t('mobile.dealerHome.roleLabel')}
          </AppText>
          <AppText variant="bodySecondary" color="secondary">
            {formatDate(new Date())}
          </AppText>
        </View>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.xs,
            alignItems: 'flex-start',
          }}
        >
          <IconButton
            accessibilityLabel={t('mobile.search.title')}
            onPress={() => router.push('/(app)/search' as Href)}
          >
            <AppText variant="title" weight="semibold" color="brand">
              ⌕
            </AppText>
          </IconButton>
          {canOpenNotifications ? (
            <View>
              <IconButton
                accessibilityLabel={t('mobile.dealerHome.notificationsA11y')}
                onPress={() => router.push('/(app)/notifications' as Href)}
              >
                <AppText variant="title" weight="semibold" color="brand">
                  ✦
                </AppText>
              </IconButton>
              {unreadNotifications > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 2,
                    ...(isRTL ? { left: 2 } : { right: 2 }),
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: colors.error,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    style={{ color: colors.onBrand, fontSize: 10, lineHeight: 12 }}
                  >
                    {unreadNotifications > 99 ? '99+' : String(unreadNotifications)}
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
