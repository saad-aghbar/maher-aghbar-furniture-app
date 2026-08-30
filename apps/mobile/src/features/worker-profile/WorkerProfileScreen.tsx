import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/auth/AuthProvider';
import {
  canUseBiometrics,
  isBiometricUnlockEnabled,
  promptBiometricUnlock,
  setBiometricUnlockEnabled,
} from '@/auth/biometrics';
import { AppText } from '@/components/AppText';
import { ExpandableLocaleSwitcher } from '@/components/ExpandableLocaleSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { PasswordField } from '@/components/forms/PasswordField';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { Divider } from '@/components/layout/Divider';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { MoreBoard } from '@/features/more/components/MoreBoard';
import { DevTestsEntryRow } from '@/dev/component-lab/screens/DevTestsEntryRow';
import { useLocale } from '@/i18n';
import { rolesLabel } from '@/i18n/roleLabel';
import { haptics, useReducedMotion } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';

/**
 * Worker profile — same floor-board / prefs language as admin More + account.
 */
export function WorkerProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  /** ScrollView `gap` can drop paddingBottom — spacer uses the requested tab-bar inset. */
  const listBottomClearance = insets.bottom + SURFACE_TAB_BAR_CLEARANCE;
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  const refreshBio = useCallback(async () => {
    const [available, enabled] = await Promise.all([
      canUseBiometrics(),
      isBiometricUnlockEnabled(),
    ]);
    setBioAvailable(available);
    setBioEnabled(enabled);
  }, []);

  useEffect(() => {
    void refreshBio();
  }, [refreshBio]);

  async function onToggleBiometrics(next: boolean) {
    if (bioBusy) return;
    setBioBusy(true);
    try {
      if (next) {
        const ok = await promptBiometricUnlock(t('auth.biometricPrompt'), t('common.cancel'));
        if (!ok) {
          void haptics.error();
          showToast({
            variant: 'error',
            message: t('mobile.more.biometricEnableFailed'),
          });
          return;
        }
        await setBiometricUnlockEnabled(true);
        setBioEnabled(true);
        void haptics.confirmMedium();
        showToast({
          variant: 'success',
          message: t('auth.biometricEnabled'),
        });
      } else {
        await setBiometricUnlockEnabled(false);
        setBioEnabled(false);
        void haptics.selection();
        showToast({
          variant: 'success',
          message: t('auth.biometricDisabled'),
        });
      }
    } finally {
      setBioBusy(false);
    }
  }

  if (!user) return null;

  const displayName = user.name?.trim() || user.username || '—';
  const first = displayName.trim().split(/\s+/)[0] || displayName;
  const roles =
    user.roles.length > 0
      ? rolesLabel(t, user.roles)
      : t('mobile.persona.production_worker');

  const enter = (delay: number) =>
    reduce ? undefined : FadeInDown.delay(delay).duration(380).damping(22);

  return (
    <ScrollableScreen contentContainerStyle={{ paddingBottom: 0 }}>
      {showOfflineBanner ? <OfflineBanner /> : null}

      <View
        style={{
          marginBottom: theme.spacing.md,
          gap: theme.spacing.xs,
          alignItems: isRTL ? 'flex-end' : 'flex-start',
        }}
      >
        <AppText
          variant="caption"
          weight={locale === 'ar' ? 'regular' : 'medium'}
          style={{
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.workerProfile.floorEyebrow')}
        </AppText>
        <AppText
          variant="title"
          weight={titleWeight}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.workerProfile.title')}
        </AppText>
        <AppText
          variant="caption"
          color="muted"
          weight="regular"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.workerProfile.subtitle')}
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <Animated.View entering={enter(40)}>
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
                  style={{ color: colors.brand }}
                >
                  {t('mobile.workerProfile.identityEyebrow')}
                </AppText>
                <AppText variant="heading" weight={titleWeight} numberOfLines={1}>
                  {t('mobile.workerProfile.identityHello', { name: first })}
                </AppText>
                {user.username ? (
                  <AppText variant="caption" color="muted" weight="regular" numberOfLines={1}>
                    @{user.username}
                  </AppText>
                ) : null}
                <AppText
                  variant="caption"
                  color="secondary"
                  weight="regular"
                  numberOfLines={2}
                >
                  {roles}
                </AppText>
              </View>
            </View>
          </MoreBoard>
        </Animated.View>

        <Animated.View entering={enter(100)} style={{ gap: theme.spacing.sm }}>
          <SectionLabel label={t('mobile.workerProfile.appearanceSection')} locale={locale} />
          <MoreBoard
            style={{
              padding: theme.spacing.lg,
              paddingLeft: isRTL ? theme.spacing.lg : theme.spacing.lg + 4,
              paddingRight: isRTL ? theme.spacing.lg + 4 : theme.spacing.lg,
              gap: theme.spacing.md,
            }}
          >
            <PrefRow
              label={t('mobile.themeMode')}
              hint={t('mobile.workerProfile.themeHint')}
              isRTL={isRTL}
              titleWeight={titleWeight}
              control={<ThemeSwitcher />}
            />
            <Divider compact />
            <PrefRow
              label={t('mobile.switchLanguage')}
              hint={t('mobile.workerProfile.languageHint')}
              isRTL={isRTL}
              titleWeight={titleWeight}
              control={
                <ExpandableLocaleSwitcher expandToward={isRTL ? 'start' : 'end'} />
              }
            />
          </MoreBoard>
        </Animated.View>

        <Animated.View entering={enter(130)} style={{ gap: theme.spacing.sm }}>
          <SectionLabel label={t('mobile.more.securitySection')} locale={locale} />
          <MoreBoard
            style={{
              padding: theme.spacing.lg,
              paddingLeft: isRTL ? theme.spacing.lg : theme.spacing.lg + 4,
              paddingRight: isRTL ? theme.spacing.lg + 4 : theme.spacing.lg,
              gap: theme.spacing.md,
            }}
          >
            {bioAvailable ? (
              <PrefRow
                label={t('mobile.more.biometricLabel')}
                hint={t('mobile.more.biometricHint')}
                isRTL={isRTL}
                titleWeight={titleWeight}
                control={
                  <Switch
                    value={bioEnabled}
                    disabled={bioBusy}
                    onValueChange={(v) => void onToggleBiometrics(v)}
                    trackColor={{ false: colors.border, true: colors.brandSoft }}
                    thumbColor={bioEnabled ? colors.brand : colors.surfaceSecondary}
                    accessibilityLabel={t('mobile.more.biometricLabel')}
                  />
                }
              />
            ) : (
              <AppText variant="caption" color="muted" weight="regular">
                {t('mobile.more.biometricUnavailable')}
              </AppText>
            )}
            <Divider compact />
            <PasswordField
              label={t('auth.password')}
              value=""
              editable={false}
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              hint={t('mobile.more.portalPasswordHint')}
            />
          </MoreBoard>
        </Animated.View>

        <Divider />

        <Animated.View entering={enter(160)}>
          <DevTestsEntryRow />
        </Animated.View>

        <Animated.View entering={enter(180)}>
          <DestructiveButton
            label={t('auth.logout')}
            onPress={() => {
              void logout().then(() => router.replace('/(auth)/login' as Href));
            }}
            style={{ borderRadius: theme.radius.xl }}
          />
        </Animated.View>
      </View>

      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ height: listBottomClearance }}
      />
    </ScrollableScreen>
  );
}

function SectionLabel({ label, locale }: { label: string; locale: string }) {
  const { colors } = useTheme();
  return (
    <AppText
      variant="caption"
      weight={locale === 'ar' ? 'regular' : 'medium'}
      style={{
        letterSpacing: locale === 'ar' ? 0 : 0.8,
        textTransform: locale === 'ar' ? 'none' : 'uppercase',
        color: colors.brand,
        fontSize: 11,
      }}
    >
      {label}
    </AppText>
  );
}

function PrefRow({
  label,
  hint,
  isRTL,
  titleWeight,
  control,
}: {
  label: string;
  hint: string;
  isRTL: boolean;
  titleWeight: 'medium' | 'semibold';
  control: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
        <AppText variant="label" weight={titleWeight}>
          {label}
        </AppText>
        <AppText variant="caption" color="muted" weight="regular">
          {hint}
        </AppText>
      </View>
      {control}
    </View>
  );
}
