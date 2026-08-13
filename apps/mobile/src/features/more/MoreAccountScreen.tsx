import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import {
  changePassword,
  confirmMfa,
  disableMfa,
  enableMfa,
  updateMe,
} from '@/api/modules/auth';
import { isApiError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { toastMessageForError } from '@/api/queryClient';
import { BackButton } from '@/components/BackButton';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { TextField } from '@/components/forms/TextField';
import { PasswordField } from '@/components/forms/PasswordField';
import { PhoneField } from '@/components/forms/PhoneField';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { Divider } from '@/components/layout/Divider';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ExpandableLocaleSwitcher } from '@/components/ExpandableLocaleSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useLocale } from '@/i18n';
import { rolesLabel } from '@/i18n/roleLabel';
import { haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { MoreBoard } from './components/MoreBoard';
import { useAuth } from '@/auth/AuthProvider';
import {
  canUseBiometrics,
  isBiometricUnlockEnabled,
  promptBiometricUnlock,
  setBiometricUnlockEnabled,
} from '@/auth/biometrics';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0]!, last: '' };
  return { first: parts[0]!, last: parts.slice(1).join(' ') };
}

/** Manage account — editable profile, appearance, security (password + MFA). */
export function MoreAccountScreen({
  backFallback = '/(app)/(admin)/(tabs)/more' as Href,
  backLabelKey,
  titleMode = 'admin',
}: {
  backFallback?: Href;
  /** Override back button label i18n key (e.g. mobile.dealerAccount.backToAccount). */
  backLabelKey?: string;
  /** Dealer security hub uses dealer-facing titles instead of More chrome. */
  titleMode?: 'admin' | 'dealer';
} = {}) {
  const { user, logout, applyUser, refreshUser } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const dealerTitles = titleMode === 'dealer';
  const backLabel = t(backLabelKey ?? (dealerTitles ? 'mobile.dealerAccount.backToAccount' : 'mobile.more.backToMore'));
  const eyebrow = dealerTitles ? t('mobile.dealerAccount.securityEyebrow') : t('mobile.more.accountEyebrow');
  const title = dealerTitles ? t('mobile.dealerAccount.securityTitle') : t('mobile.more.accountTitle');
  const subtitle = dealerTitles ? t('mobile.dealerAccount.securitySubtitle') : t('mobile.more.accountSubtitle');
  const reduce = useReducedMotion();
  const queryClient = useQueryClient();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  const nameParts = useMemo(
    () =>
      user
        ? {
            first: user.firstName ?? splitName(user.name).first,
            last: user.lastName ?? splitName(user.name).last,
          }
        : { first: '', last: '' },
    [user],
  );

  const [firstName, setFirstName] = useState(nameParts.first);
  const [lastName, setLastName] = useState(nameParts.last);
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaOtpauth, setMfaOtpauth] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? splitName(user.name).first);
    setLastName(user.lastName ?? splitName(user.name).last);
    setEmail(user.email ?? '');
    setPhone(user.phone ?? '');
  }, [user]);

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

  const profileMutation = useMutation({
    mutationFn: () =>
      updateMe({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      }),
    onSuccess: (profile) => {
      applyUser(profile);
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.more.profileSaved') });
    },
    onError: (err) => {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.more.saveFailed'),
      });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      changePassword({
        currentPassword,
        newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.more.passwordChangeSuccess') });
    },
    onError: (err) => {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.more.saveFailed'),
      });
    },
  });

  const mfaEnableMutation = useMutation({
    mutationFn: () => enableMfa(),
    onSuccess: (data) => {
      setMfaSecret(data.secret);
      setMfaOtpauth(data.otpauthUrl);
      void refreshUser();
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      showToast({ variant: 'success', message: t('auth.mfaSetupHint') });
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.more.saveFailed'),
      });
    },
  });

  const mfaConfirmMutation = useMutation({
    mutationFn: () => confirmMfa(mfaCode.trim()),
    onSuccess: async () => {
      setMfaSecret(null);
      setMfaOtpauth(null);
      setMfaCode('');
      await refreshUser();
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('auth.mfaEnabled') });
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.more.saveFailed'),
      });
    },
  });

  const mfaDisableMutation = useMutation({
    mutationFn: () => disableMfa(),
    onSuccess: async () => {
      setMfaSecret(null);
      setMfaOtpauth(null);
      setMfaCode('');
      await refreshUser();
      showToast({ variant: 'success', message: t('auth.mfaDisabled') });
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.more.saveFailed'),
      });
    },
  });

  if (!user) return null;

  const roles =
    user.roles.length > 0 ? rolesLabel(t, user.roles) : t('mobile.more.roleFallback');

  const enter = (delay: number) =>
    reduce ? undefined : FadeInDown.delay(delay).duration(360).damping(22);

  const passwordMismatch =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword !== confirmPassword;

  const canSavePassword =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    !passwordMismatch &&
    !passwordMutation.isPending;

  const mfaEnabled = user.mfaEnabled;
  const mfaPendingServer = user.mfaPending;
  const setupActive = Boolean(mfaSecret);

  return (
    <ScrollableScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}

      <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
        {dealerTitles ? (
          <View style={{ gap: theme.spacing.xs }}>
            <View
              style={{
                minHeight: theme.sizes.touch.min,
                justifyContent: 'center',
              }}
            >
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
                variant="title"
                weight={titleWeight}
                align="center"
                numberOfLines={1}
                style={{ paddingHorizontal: theme.sizes.touch.min + theme.spacing.sm }}
              >
                {title}
              </AppText>
            </View>
            <AppText
              variant="caption"
              color="muted"
              weight="regular"
              align="center"
              style={{ paddingHorizontal: theme.spacing.lg }}
            >
              {subtitle}
            </AppText>
          </View>
        ) : (
          <>
            <BackButton
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace(backFallback);
              }}
              label={backLabel}
            />
            <View style={{ gap: theme.spacing.xs }}>
              <AppText
                variant="caption"
                weight={locale === 'ar' ? 'regular' : 'medium'}
                style={{
                  letterSpacing: locale === 'ar' ? 0 : 1.4,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  color: colors.brand,
                }}
              >
                {eyebrow}
              </AppText>
              <AppText variant="title" weight={titleWeight}>
                {title}
              </AppText>
              <AppText variant="caption" color="muted" weight="regular">
                {subtitle}
              </AppText>
            </View>
          </>
        )}
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <Animated.View entering={enter(40)} style={{ gap: theme.spacing.sm }}>
          <SectionLabel label={t('mobile.more.profileSection')} locale={locale} />
          <MoreBoard
            style={{
              padding: theme.spacing.lg,
              paddingLeft: isRTL ? theme.spacing.lg : theme.spacing.lg + 4,
              paddingRight: isRTL ? theme.spacing.lg + 4 : theme.spacing.lg,
              gap: theme.spacing.md,
            }}
          >
            <ProfileRow
              label={t('users.username')}
              value={`@${user.username}`}
              isRTL={isRTL}
            />
            <ProfileRow label={t('users.roles')} value={roles} isRTL={isRTL} />
            <TextField
              label={t('users.firstName')}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            <TextField
              label={t('users.lastName')}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
            <TextField
              label={t('users.email')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <PhoneField
              label={t('users.phone')}
              value={phone}
              onChangeText={setPhone}
            />
            <PrimaryButton
              label={t('mobile.more.saveProfile')}
              loading={profileMutation.isPending}
              disabled={profileMutation.isPending || !firstName.trim() || !lastName.trim()}
              onPress={() => profileMutation.mutate()}
              style={{ borderRadius: theme.radius.xl }}
            />
          </MoreBoard>
        </Animated.View>

        <Animated.View entering={enter(100)} style={{ gap: theme.spacing.sm }}>
          <SectionLabel label={t('mobile.more.appearanceSection')} locale={locale} />
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
              hint={t('mobile.more.themeHint')}
              isRTL={isRTL}
              titleWeight={titleWeight}
              control={<ThemeSwitcher />}
            />
            <Divider compact />
            <PrefRow
              label={t('mobile.switchLanguage')}
              hint={t('mobile.more.languageHint')}
              isRTL={isRTL}
              titleWeight={titleWeight}
              control={<ExpandableLocaleSwitcher expandToward={isRTL ? 'start' : 'end'} />}
            />
          </MoreBoard>
        </Animated.View>

        <Animated.View entering={enter(160)} style={{ gap: theme.spacing.sm }}>
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

            {!user?.customerId ? (
              <>
                <AppText variant="label" weight={titleWeight}>
                  {t('auth.password')}
                </AppText>
                <TextField
                  label={t('mobile.more.currentPassword')}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextField
                  label={t('users.newPassword')}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextField
                  label={t('mobile.more.confirmPassword')}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={passwordMismatch ? t('mobile.more.passwordMismatch') : undefined}
                />
                <PrimaryButton
                  label={t('mobile.more.changePassword')}
                  loading={passwordMutation.isPending}
                  disabled={!canSavePassword}
                  onPress={() => passwordMutation.mutate()}
                  style={{ borderRadius: theme.radius.xl }}
                />

                <Divider compact />
              </>
            ) : (
              <>
                <PasswordField
                  label={t('auth.password')}
                  value={user?.portalPassword ?? ''}
                  editable={false}
                  showLabel={t('auth.showPassword')}
                  hideLabel={t('auth.hidePassword')}
                  hint={
                    user?.portalPassword
                      ? t('mobile.more.portalPasswordHint')
                      : t('mobile.more.portalPasswordUnavailable')
                  }
                />
                <Divider compact />
              </>
            )}

            <AppText variant="label" weight={titleWeight}>
              {t('auth.mfaSetup')}
            </AppText>
            <AppText variant="caption" color="muted">
              {mfaEnabled
                ? t('auth.mfaEnabled')
                : setupActive
                  ? t('auth.mfaSetupHint')
                  : mfaPendingServer
                    ? t('mobile.more.mfaResumeHint')
                    : t('auth.mfaDisabled')}
            </AppText>

            {/* Fresh setup — MFA off and nothing pending on server */}
            {!mfaEnabled && !mfaPendingServer && !setupActive ? (
              <SecondaryButton
                label={t('auth.mfaEnable')}
                loading={mfaEnableMutation.isPending}
                onPress={() => mfaEnableMutation.mutate()}
                style={{ borderRadius: theme.radius.xl }}
              />
            ) : null}

            {/* Left mid-setup earlier — resume or cancel, no code box until secret is local */}
            {!mfaEnabled && mfaPendingServer && !setupActive ? (
              <View style={{ gap: theme.spacing.sm }}>
                <SecondaryButton
                  label={t('mobile.more.mfaResume')}
                  loading={mfaEnableMutation.isPending}
                  onPress={() => mfaEnableMutation.mutate()}
                  style={{ borderRadius: theme.radius.xl }}
                />
                <DestructiveButton
                  label={t('mobile.more.mfaCancelSetup')}
                  loading={mfaDisableMutation.isPending}
                  onPress={() => mfaDisableMutation.mutate()}
                  style={{ borderRadius: theme.radius.xl }}
                />
              </View>
            ) : null}

            {/* Active setup this visit — secret + code + confirm */}
            {setupActive ? (
              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="caption" color="secondary" dir="ltr">
                  {t('auth.mfaSecret')}: {mfaSecret}
                </AppText>
                {mfaOtpauth ? (
                  <Pressable
                    onPress={() => {
                      void Linking.openURL(mfaOtpauth);
                    }}
                  >
                    <AppText variant="caption" style={{ color: colors.brand }} dir="ltr">
                      {t('mobile.more.mfaOpenAuthenticator')}
                    </AppText>
                  </Pressable>
                ) : null}
                <TextField
                  label={t('auth.mfaCode')}
                  value={mfaCode}
                  onChangeText={setMfaCode}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />
                <PrimaryButton
                  label={t('auth.mfaConfirm')}
                  loading={mfaConfirmMutation.isPending}
                  disabled={mfaCode.trim().length < 6 || mfaConfirmMutation.isPending}
                  onPress={() => mfaConfirmMutation.mutate()}
                  style={{ borderRadius: theme.radius.xl }}
                />
                <DestructiveButton
                  label={t('mobile.more.mfaCancelSetup')}
                  loading={mfaDisableMutation.isPending}
                  onPress={() => mfaDisableMutation.mutate()}
                  style={{ borderRadius: theme.radius.xl }}
                />
              </View>
            ) : null}

            {mfaEnabled ? (
              <DestructiveButton
                label={t('auth.mfaDisable')}
                loading={mfaDisableMutation.isPending}
                onPress={() => mfaDisableMutation.mutate()}
                style={{ borderRadius: theme.radius.xl }}
              />
            ) : null}
          </MoreBoard>
        </Animated.View>

        <Animated.View entering={enter(220)}>
          <DestructiveButton
            label={t('auth.logout')}
            onPress={() => {
              void logout().then(() => router.replace('/(auth)/login' as Href));
            }}
            style={{ borderRadius: theme.radius.xl }}
          />
        </Animated.View>
      </View>
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

function ProfileRow({
  label,
  value,
  isRTL,
}: {
  label: string;
  value: string;
  isRTL: boolean;
}) {
  return (
    <View style={{ gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
      <AppText variant="caption" color="muted" weight="regular">
        {label}
      </AppText>
      <AppText variant="body" weight="medium" numberOfLines={2}>
        {value}
      </AppText>
    </View>
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
