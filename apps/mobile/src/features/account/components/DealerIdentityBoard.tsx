import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { AuthUser } from '@maher/types';
import { AppText } from '@/components/AppText';
import { MoreBoard } from '@/features/more/components/MoreBoard';
import { useLocale } from '@/i18n';
import { useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  user: AuthUser;
};

/** Company identity board — avatar + company hello + contact meta. */
export function DealerIdentityBoard({ user }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const company = user.name?.trim() || t('mobile.dealerAccount.companyFallback');
  const first = company.split(/\s+/)[0] || company;

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
            <Ionicons name="business-outline" size={26} color={colors.brand} />
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
              {t('mobile.dealerAccount.identityEyebrow')}
            </AppText>
            <AppText variant="heading" weight={titleWeight} numberOfLines={1}>
              {t('mobile.dealerAccount.identityHello', { name: first })}
            </AppText>
            {user.username ? (
              <AppText
                variant="caption"
                color="muted"
                weight="regular"
                numberOfLines={1}
                dir="ltr"
              >
                @{user.username}
              </AppText>
            ) : null}
            {user.email ? (
              <AppText
                variant="caption"
                color="secondary"
                weight="regular"
                numberOfLines={1}
                dir="ltr"
              >
                {user.email}
              </AppText>
            ) : null}
            {user.phone ? (
              <AppText
                variant="caption"
                color="secondary"
                weight="regular"
                numberOfLines={1}
                dir="ltr"
              >
                {user.phone}
              </AppText>
            ) : null}
          </View>
        </View>
      </MoreBoard>
    </Shell>
  );
}
