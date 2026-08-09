import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { AuthUser } from '@maher/types';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { MoreBoard } from './MoreBoard';

type Props = {
  user: AuthUser;
};

/** Identity board — who you are on the floor. */
export function MoreIdentityBoard({ user }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const first = user.name.trim().split(/\s+/)[0] || user.name;
  const roles =
    user.roles.length > 0
      ? user.roles.map((r) => r.replace(/_/g, ' ')).join(' · ')
      : t('mobile.more.roleFallback');

  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce
    ? {}
    : { entering: FadeInDown.delay(40).duration(380).damping(22) };

  return (
    <Shell {...shellProps}>
      <MoreBoard
        style={{
          padding: theme.spacing.lg,
          paddingLeft: isRTL ? theme.spacing.lg : theme.spacing.lg + 4,
          paddingRight: isRTL ? theme.spacing.lg + 4 : theme.spacing.lg,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="person-outline" size={26} color={colors.brand} />
          </View>
          <View
            style={{
              flex: 1,
              gap: theme.spacing.xs,
              alignItems: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            <AppText
              variant="caption"
              weight={locale === 'ar' ? 'regular' : 'medium'}
              style={{
                letterSpacing: locale === 'ar' ? 0 : 1.2,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                color: colors.brand,
              }}
            >
              {t('mobile.more.identityEyebrow')}
            </AppText>
            <AppText variant="heading" weight={titleWeight} numberOfLines={1}>
              {t('mobile.more.identityHello', { name: first })}
            </AppText>
            <AppText variant="caption" color="muted" weight="regular" numberOfLines={1}>
              @{user.username}
            </AppText>
            <AppText variant="caption" color="secondary" weight="regular" numberOfLines={2}>
              {roles}
            </AppText>
          </View>
        </View>
      </MoreBoard>
    </Shell>
  );
}
