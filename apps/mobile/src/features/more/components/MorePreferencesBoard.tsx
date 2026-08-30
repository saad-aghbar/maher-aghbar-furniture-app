import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { ExpandableLocaleSwitcher } from '@/components/ExpandableLocaleSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { MoreBoard } from './MoreBoard';

/** Preferences board — theme + locale inline, account + settings CTAs. */
export function MorePreferencesBoard() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const canManageSettings = can(user, 'settings.manage');

  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce
    ? {}
    : { entering: FadeInDown.delay(100).duration(380).damping(22) };

  return (
    <Shell {...shellProps} style={{ gap: theme.spacing.sm }}>
      <AppText
        variant="caption"
        color="muted"
        weight={locale === 'ar' ? 'regular' : 'medium'}
        style={{ fontSize: 11 }}
      >
        {t('mobile.more.prefsEyebrow')}
      </AppText>

      <MoreBoard
        style={{
          padding: theme.spacing.lg,
          paddingLeft: isRTL ? theme.spacing.lg : theme.spacing.lg + 4,
          paddingRight: isRTL ? theme.spacing.lg + 4 : theme.spacing.lg,
          gap: theme.spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <AppText variant="heading" weight={titleWeight}>
              {t('mobile.more.prefsTitle')}
            </AppText>
            <AppText variant="caption" color="muted" weight="regular">
              {t('mobile.more.prefsHint')}
            </AppText>
          </View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <ExpandableLocaleSwitcher expandToward={isRTL ? 'end' : 'start'} />
            <ThemeSwitcher />
          </View>
        </View>

        <HubCta
          icon="person-outline"
          label={t('mobile.more.manageAccount')}
          isRTL={isRTL}
          titleWeight={titleWeight}
          primary
          onPress={() => {
            void haptics.selection();
            router.push('/(app)/(admin)/more/account' as Href);
          }}
        />

        {canManageSettings ? (
          <HubCta
            icon="business-outline"
            label={t('mobile.more.moreSettings')}
            isRTL={isRTL}
            titleWeight={titleWeight}
            primary={false}
            onPress={() => {
              void haptics.selection();
              router.push('/(app)/(admin)/more/settings' as Href);
            }}
          />
        ) : null}
      </MoreBoard>
    </Shell>
  );
}

function HubCta({
  icon,
  label,
  isRTL,
  titleWeight,
  primary,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  isRTL: boolean;
  titleWeight: 'medium' | 'semibold';
  primary: boolean;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  const fg = primary ? colors.onBrand : colors.brand;
  const bg = primary ? colors.brand : colors.brandSoft;
  const border = colors.brand;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 48,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
        paddingHorizontal: theme.spacing.lg,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...(primary ? theme.elevation.card : null),
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <Ionicons name={icon} size={18} color={fg} />
        <AppText variant="label" weight={titleWeight} style={{ color: fg }}>
          {label}
        </AppText>
      </View>
      <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={18} color={fg} />
    </AnimatedPressable>
  );
}
