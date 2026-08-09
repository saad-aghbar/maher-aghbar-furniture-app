import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import {
  getSettings,
  patchCompanySettings,
  patchIntegrationsSettings,
  type CompanySettings,
  type IntegrationsSettings,
} from '@/api/modules/settings';
import { isApiError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { toastMessageForError } from '@/api/queryClient';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { TextField } from '@/components/forms/TextField';
import { PhoneField } from '@/components/forms/PhoneField';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { MoreBoard } from './components/MoreBoard';

const COMPANY_DEFAULTS: CompanySettings = {
  nameAr: '',
  nameEn: '',
  currency: 'JOD',
  defaultVatPercent: 16,
  timezone: 'Asia/Amman',
  defaultLanguage: 'ar',
  quotationValidityDays: 14,
  invoiceTermsDays: 30,
  lowStockAlertsEnabled: true,
  autoReorderEnabled: true,
  phone: '',
  email: '',
  address: '',
};

const PROVIDERS = {
  email: ['console', 'smtp'],
  whatsapp: ['console', 'twilio', 'meta'],
  sms: ['console', 'twilio'],
  ai: ['mock', 'openai'],
  ocr: ['mock', 'local', 'tesseract', 'openai', 'http'],
} as const;

/** Company + integrations settings — website parity with dedicated Save per board. */
export function AdminSettingsScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const reduce = useReducedMotion();
  const queryClient = useQueryClient();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const allowed = can(user, 'settings.manage');

  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationsSettings | null>(null);

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings.root(),
    queryFn: getSettings,
    enabled: allowed,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    const c = settingsQuery.data.company;
    const i = settingsQuery.data.integrations;
    if (c) {
      setCompany({
        ...COMPANY_DEFAULTS,
        ...c,
        lowStockAlertsEnabled: c.lowStockAlertsEnabled ?? true,
        autoReorderEnabled: c.autoReorderEnabled ?? true,
      });
    }
    if (i) setIntegrations({ ...i });
  }, [settingsQuery.data]);

  const companyMutation = useMutation({
    mutationFn: () => {
      if (!company) throw new Error('missing company');
      return patchCompanySettings(company);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.root() });
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.adminSettings.companySaved') });
    },
    onError: (err) => {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err)
          ? toastMessageForError(err)
          : t('mobile.adminSettings.saveFailed'),
      });
    },
  });

  const integrationsMutation = useMutation({
    mutationFn: () => {
      if (!integrations) throw new Error('missing integrations');
      return patchIntegrationsSettings(integrations);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.root() });
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.adminSettings.integrationsSaved') });
    },
    onError: (err) => {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err)
          ? toastMessageForError(err)
          : t('mobile.adminSettings.saveFailed'),
      });
    },
  });

  const enter = (delay: number) =>
    reduce ? undefined : FadeInDown.delay(delay).duration(360).damping(22);

  if (!allowed) {
    return (
      <ScrollableScreen>
        <BackButton
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(app)/(admin)/(tabs)/more' as Href);
          }}
          label={t('mobile.more.backToMore')}
        />
        <EmptyState
          title={t('mobile.adminSettings.forbiddenTitle')}
          description={t('mobile.adminSettings.forbiddenBody')}
        />
      </ScrollableScreen>
    );
  }

  if (settingsQuery.isError) {
    return (
      <ScrollableScreen>
        <BackButton
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(app)/(admin)/(tabs)/more' as Href);
          }}
          label={t('mobile.more.backToMore')}
        />
        <ErrorState
          title={t('catalog.settings')}
          description={t('common.loadFailed')}
          onRetry={() => void settingsQuery.refetch()}
        />
      </ScrollableScreen>
    );
  }

  if (settingsQuery.isLoading || !company || !integrations) {
    return (
      <ScrollableScreen>
        <BackButton
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(app)/(admin)/(tabs)/more' as Href);
          }}
          label={t('mobile.more.backToMore')}
        />
        <AppText variant="body" color="muted">
          {t('mobile.adminSettings.loading')}
        </AppText>
      </ScrollableScreen>
    );
  }

  const configuredLabel = (ok?: boolean) =>
    ok
      ? t('catalog.integrationConfigured')
      : t('catalog.integrationNotConfigured');

  return (
    <ScrollableScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}

      <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
        <BackButton
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(app)/(admin)/(tabs)/more' as Href);
          }}
          label={t('mobile.more.backToMore')}
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
            {t('mobile.adminSettings.eyebrow')}
          </AppText>
          <AppText variant="title" weight={titleWeight}>
            {t('catalog.settings')}
          </AppText>
          <AppText variant="caption" color="muted">
            {t('mobile.adminSettings.subtitle')}
          </AppText>
        </View>
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <Animated.View entering={enter(40)} style={{ gap: theme.spacing.sm }}>
          <SectionLabel label={t('catalog.company')} locale={locale} />
          <MoreBoard
            style={{
              padding: theme.spacing.lg,
              paddingLeft: isRTL ? theme.spacing.lg : theme.spacing.lg + 4,
              paddingRight: isRTL ? theme.spacing.lg + 4 : theme.spacing.lg,
              gap: theme.spacing.md,
            }}
          >
            <TextField
              label={t('catalog.nameAr')}
              value={company.nameAr}
              onChangeText={(v) => setCompany({ ...company, nameAr: v })}
            />
            <TextField
              label={t('catalog.nameEn')}
              value={company.nameEn}
              onChangeText={(v) => setCompany({ ...company, nameEn: v })}
            />
            <PhoneField
              label={t('catalog.phone')}
              value={company.phone}
              onChangeText={(v) => setCompany({ ...company, phone: v })}
            />
            <TextField
              label={t('catalog.email')}
              value={company.email}
              onChangeText={(v) => setCompany({ ...company, email: v })}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextField
              label={t('common.address')}
              value={company.address}
              onChangeText={(v) => setCompany({ ...company, address: v })}
            />
            <TextField
              label={t('catalog.currencyLabel')}
              value={company.currency}
              onChangeText={(v) => setCompany({ ...company, currency: v })}
              autoCapitalize="characters"
            />
            <TextField
              label={t('catalog.defaultVat')}
              value={String(company.defaultVatPercent)}
              onChangeText={(v) =>
                setCompany({ ...company, defaultVatPercent: Number(v) || 0 })
              }
              keyboardType="decimal-pad"
            />
            <TextField
              label={t('catalog.timezone')}
              value={company.timezone}
              onChangeText={(v) => setCompany({ ...company, timezone: v })}
              autoCapitalize="none"
            />
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="caption" color="muted">
                {t('catalog.defaultLanguage')}
              </AppText>
              <ChipRow
                isRTL={isRTL}
                options={[
                  { value: 'ar', label: t('mobile.languageName.ar') },
                  { value: 'en', label: t('mobile.languageName.en') },
                  { value: 'he', label: t('mobile.languageName.he') },
                ]}
                value={company.defaultLanguage}
                onChange={(v) => setCompany({ ...company, defaultLanguage: v })}
              />
            </View>
            <TextField
              label={t('catalog.quotationValidityDays')}
              value={String(company.quotationValidityDays)}
              onChangeText={(v) =>
                setCompany({ ...company, quotationValidityDays: Number(v) || 0 })
              }
              keyboardType="number-pad"
            />
            <TextField
              label={t('catalog.invoiceTermsDays')}
              value={String(company.invoiceTermsDays)}
              onChangeText={(v) =>
                setCompany({ ...company, invoiceTermsDays: Number(v) || 0 })
              }
              keyboardType="number-pad"
            />
            <ToggleRow
              label={t('catalog.lowStockAlerts')}
              value={company.lowStockAlertsEnabled}
              onChange={(v) => setCompany({ ...company, lowStockAlertsEnabled: v })}
              isRTL={isRTL}
            />
            <ToggleRow
              label={t('catalog.autoReorderEnabled')}
              value={company.autoReorderEnabled}
              onChange={(v) => setCompany({ ...company, autoReorderEnabled: v })}
              isRTL={isRTL}
            />
            <PrimaryButton
              label={t('mobile.adminSettings.saveCompany')}
              loading={companyMutation.isPending}
              disabled={companyMutation.isPending}
              onPress={() => companyMutation.mutate()}
              style={{ borderRadius: theme.radius.xl }}
            />
          </MoreBoard>
        </Animated.View>

        <Animated.View entering={enter(120)} style={{ gap: theme.spacing.sm }}>
          <SectionLabel label={t('catalog.integrations')} locale={locale} />
          <MoreBoard
            style={{
              padding: theme.spacing.lg,
              paddingLeft: isRTL ? theme.spacing.lg : theme.spacing.lg + 4,
              paddingRight: isRTL ? theme.spacing.lg + 4 : theme.spacing.lg,
              gap: theme.spacing.md,
            }}
          >
            <AppText variant="caption" color="muted">
              {t('catalog.integrationsHint')}
            </AppText>

            <IntegrationBlock
              title={t('catalog.integrationJoFotara')}
              status={configuredLabel(integrations.jofotaraConfigured)}
              isRTL={isRTL}
              titleWeight={titleWeight}
            >
              <TextField
                label={t('catalog.jofotaraBaseUrl')}
                value={integrations.jofotaraBaseUrl ?? ''}
                onChangeText={(v) =>
                  setIntegrations({ ...integrations, jofotaraBaseUrl: v })
                }
                autoCapitalize="none"
              />
            </IntegrationBlock>

            <IntegrationBlock
              title={t('catalog.integrationWhatsApp')}
              status={configuredLabel(integrations.whatsappLiveConfigured)}
              isRTL={isRTL}
              titleWeight={titleWeight}
            >
              <ProviderChips
                label={t('catalog.provider')}
                options={[...PROVIDERS.whatsapp]}
                value={integrations.whatsappProvider}
                onChange={(v) =>
                  setIntegrations({ ...integrations, whatsappProvider: v })
                }
                isRTL={isRTL}
              />
              <AppText variant="caption" color="muted">
                {t('catalog.whatsappInboundStatus')}:{' '}
                {configuredLabel(integrations.whatsappInboundConfigured)}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('catalog.emailInboundStatus')}:{' '}
                {configuredLabel(integrations.emailInboundConfigured)}
              </AppText>
              <ProviderChips
                label={t('catalog.smsProvider')}
                options={[...PROVIDERS.sms]}
                value={integrations.smsProvider ?? 'console'}
                onChange={(v) => setIntegrations({ ...integrations, smsProvider: v })}
                isRTL={isRTL}
              />
              <AppText variant="caption" color="muted">
                {t('catalog.smsLiveStatus')}:{' '}
                {configuredLabel(integrations.smsLiveConfigured)}
              </AppText>
            </IntegrationBlock>

            <IntegrationBlock
              title={t('catalog.integrationSmtp')}
              status={configuredLabel(integrations.smtpConfigured)}
              isRTL={isRTL}
              titleWeight={titleWeight}
            >
              <ProviderChips
                label={t('catalog.emailProvider')}
                options={[...PROVIDERS.email]}
                value={integrations.emailProvider}
                onChange={(v) => setIntegrations({ ...integrations, emailProvider: v })}
                isRTL={isRTL}
              />
              <TextField
                label={t('catalog.smtpFrom')}
                value={integrations.smtpFrom ?? ''}
                onChangeText={(v) => setIntegrations({ ...integrations, smtpFrom: v })}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </IntegrationBlock>

            <IntegrationBlock
              title={t('catalog.integrationOpenAi')}
              status={configuredLabel(integrations.openaiConfigured)}
              isRTL={isRTL}
              titleWeight={titleWeight}
            >
              <ProviderChips
                label={t('catalog.aiProvider')}
                options={[...PROVIDERS.ai]}
                value={integrations.aiProvider}
                onChange={(v) => setIntegrations({ ...integrations, aiProvider: v })}
                isRTL={isRTL}
              />
              <ProviderChips
                label={t('catalog.ocrProvider')}
                options={[...PROVIDERS.ocr]}
                value={integrations.ocrProvider}
                onChange={(v) => setIntegrations({ ...integrations, ocrProvider: v })}
                isRTL={isRTL}
              />
              <AppText variant="caption" color="muted">
                {t('catalog.ocrLiveStatus')}:{' '}
                {configuredLabel(integrations.ocrLiveConfigured)}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('catalog.ocrLocalStatus')}:{' '}
                {configuredLabel(integrations.ocrLocalConfigured)}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('catalog.storageProviderStatus')}:{' '}
                {integrations.storageProvider ?? 'local'} ·{' '}
                {configuredLabel(integrations.s3Configured)}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('catalog.mapsProviderStatus')}:{' '}
                {integrations.mapsProvider ?? '—'} ·{' '}
                {configuredLabel(integrations.mapsConfigured)}
              </AppText>
            </IntegrationBlock>

            <PrimaryButton
              label={t('mobile.adminSettings.saveIntegrations')}
              loading={integrationsMutation.isPending}
              disabled={integrationsMutation.isPending}
              onPress={() => integrationsMutation.mutate()}
              style={{ borderRadius: theme.radius.xl }}
            />
          </MoreBoard>
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

function ToggleRow({
  label,
  value,
  onChange,
  isRTL,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  isRTL: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <AppText variant="body" style={{ flex: 1 }} align={isRTL ? 'end' : 'start'}>
        {label}
      </AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.brandSoft }}
        thumbColor={value ? colors.brand : colors.surfaceSecondary}
        accessibilityLabel={label}
      />
    </View>
  );
}

function ChipRow({
  options,
  value,
  onChange,
  isRTL,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
  isRTL: boolean;
}) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.xs,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              void haptics.selection();
              onChange(opt.value);
            }}
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: active ? colors.brand : colors.borderStrong,
              backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
            }}
          >
            <AppText
              variant="caption"
              weight={active ? 'semibold' : 'regular'}
              style={{ color: active ? colors.brand : colors.textSecondary }}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function ProviderChips({
  label,
  options,
  value,
  onChange,
  isRTL,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
  isRTL: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <ChipRow
        isRTL={isRTL}
        options={options.map((p) => ({ value: p, label: p }))}
        value={value}
        onChange={onChange}
      />
    </View>
  );
}

function IntegrationBlock({
  title,
  status,
  isRTL,
  titleWeight,
  children,
}: {
  title: string;
  status: string;
  isRTL: boolean;
  titleWeight: 'medium' | 'semibold';
  children: ReactNode;
}) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <AppText variant="label" weight={titleWeight} style={{ flex: 1 }}>
          {title}
        </AppText>
        <AppText variant="caption" color="muted">
          {status}
        </AppText>
      </View>
      {children}
    </View>
  );
}
