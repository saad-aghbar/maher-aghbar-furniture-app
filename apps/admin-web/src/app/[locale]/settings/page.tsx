'use client';

import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import type { FactoryCalendarSettings } from '@/lib/scheduling';
import { Alert, Button, Card, ErrorState, Input, PageHero, Select, Skeleton } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

interface CompanySettings {
  nameAr: string;
  nameEn: string;
  currency: string;
  defaultVatPercent: number;
  timezone: string;
  defaultLanguage: string;
  quotationValidityDays: number;
  invoiceTermsDays: number;
  lowStockAlertsEnabled: boolean;
  autoReorderEnabled: boolean;
  phone: string;
  email: string;
  address: string;
}

interface IntegrationsSettings {
  emailProvider: string;
  whatsappProvider: string;
  smsProvider?: string;
  aiProvider: string;
  ocrProvider: string;
  jofotaraConfigured?: boolean;
  smtpConfigured?: boolean;
  openaiConfigured?: boolean;
  ocrLiveConfigured?: boolean;
  ocrLocalConfigured?: boolean;
  whatsappLiveConfigured?: boolean;
  smsLiveConfigured?: boolean;
  whatsappInboundConfigured?: boolean;
  emailInboundConfigured?: boolean;
  storageProvider?: string;
  s3Configured?: boolean;
  mapsConfigured?: boolean;
  mapsProvider?: string;
  smtpFrom?: string;
  jofotaraBaseUrl?: string;
}

type SettingsMap = Record<string, unknown> & {
  company?: CompanySettings;
  integrations?: IntegrationsSettings;
};

const PROVIDER_OPTIONS = {
  email: ['console', 'smtp'],
  whatsapp: ['console', 'twilio', 'meta'],
  sms: ['console', 'twilio'],
  ai: ['mock', 'openai'],
  ocr: ['mock', 'local', 'tesseract', 'openai', 'http'],
} as const;

export default function SettingsPage() {
  const tc = useTranslations('catalog');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [companyForm, setCompanyForm] = useState<CompanySettings | null>(null);
  const [integrationsForm, setIntegrationsForm] = useState<IntegrationsSettings | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaOtpauth, setMfaOtpauth] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const [calendarTimezone, setCalendarTimezone] = useState('Asia/Amman');
  const [workingWeekdays, setWorkingWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 6]);
  const [shiftStart, setShiftStart] = useState('08:00');
  const [shiftEnd, setShiftEnd] = useState('16:00');
  const [deliveryBufferWorkingDays, setDeliveryBufferWorkingDays] = useState(1);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionAction, setExceptionAction] = useState<'open' | 'close' | 'overtime'>('open');
  const [overtimeEnd, setOvertimeEnd] = useState('20:00');

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<SettingsMap>('/api/v1/settings'),
  });

  const meQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: () =>
      apiFetch<{ mfaEnabled?: boolean; mfaPending?: boolean }>('/api/v1/auth/me'),
  });

  const calendarSettingsQuery = useQuery({
    queryKey: ['scheduling-calendar-settings'],
    queryFn: () => apiFetch<FactoryCalendarSettings>('/api/v1/scheduling/calendar-settings'),
    retry: false,
  });

  useEffect(() => {
    if (settingsQuery.data?.company) {
      const c = settingsQuery.data.company;
      setCompanyForm({
        ...c,
        autoReorderEnabled: c.autoReorderEnabled ?? true,
        lowStockAlertsEnabled: c.lowStockAlertsEnabled ?? true,
      });
    }
    if (settingsQuery.data?.integrations) setIntegrationsForm(settingsQuery.data.integrations);
  }, [settingsQuery.data]);

  useEffect(() => {
    const cal = calendarSettingsQuery.data;
    if (!cal) return;
    setCalendarTimezone(cal.timezone);
    setWorkingWeekdays(cal.workingWeekdays ?? [0, 1, 2, 3, 4, 6]);
    setShiftStart(cal.shiftStart);
    setShiftEnd(cal.shiftEnd);
    setDeliveryBufferWorkingDays(cal.deliveryBufferWorkingDays ?? 1);
  }, [calendarSettingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyForm || !integrationsForm) {
        throw new ApiClientError(tCommon('emptyList'), 400);
      }
      return apiFetch('/api/v1/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          company: companyForm,
          integrations: integrationsForm,
        }),
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      setBanner(tCommon('saved'));
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const mfaEnableMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ secret: string; otpauthUrl: string }>('/api/v1/auth/mfa/enable', {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: (data) => {
      setMfaSecret(data.secret);
      setMfaOtpauth(data.otpauthUrl);
      setBanner(tAuth('mfaSetupHint'));
      void queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const mfaConfirmMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/auth/mfa/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: mfaCode.trim() }),
      }),
    onSuccess: async () => {
      setMfaSecret(null);
      setMfaOtpauth(null);
      setMfaCode('');
      setBanner(tAuth('mfaEnabled'));
      await queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const mfaDisableMutation = useMutation({
    mutationFn: () => apiFetch('/api/v1/auth/mfa/disable', { method: 'POST', body: '{}' }),
    onSuccess: async () => {
      setBanner(tAuth('mfaDisabled'));
      await queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const saveCalendarMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ replanned?: number; replanQueued?: boolean }>('/api/v1/scheduling/calendar-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          timezone: calendarTimezone.trim() || 'Asia/Amman',
          workingWeekdays: [...workingWeekdays].sort((a, b) => a - b),
          shiftStart,
          shiftEnd,
          deliveryBufferWorkingDays,
        }),
      }),
    onSuccess: async (data) => {
      setCalendarError(null);
      setBanner(
        data.replanQueued
          ? tc('calendar.recalculating')
          : (data.replanned ?? 0) > 0
            ? tc('calendar.savedReplanned', { count: data.replanned })
            : tc('calendarSaved'),
      );
      await queryClient.invalidateQueries({ queryKey: ['scheduling-calendar-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['scheduling-calendar'] });
    },
    onError: (err) => setCalendarError(mutationErrorMessage(err)),
  });

  const addExceptionMutation = useMutation({
    mutationFn: async () => {
      const date = exceptionDate.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new ApiClientError(tc('calendar.exceptions.dateInvalid'), 400);
      }
      const body =
        exceptionAction === 'close'
          ? { date, type: 'SHUTDOWN' as const, note: 'Closed by admin' }
          : exceptionAction === 'overtime'
            ? {
                date,
                type: 'EXTRA_SHIFT' as const,
                shiftStart,
                shiftEnd: overtimeEnd || '20:00',
                note: 'Overtime',
              }
            : {
                date,
                type: 'EXTRA_SHIFT' as const,
                shiftStart,
                shiftEnd,
                note: 'Opened by admin',
              };
      return apiFetch<{ replanned?: number; replanQueued?: boolean }>('/api/v1/scheduling/calendar-settings/exceptions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async (data) => {
      setCalendarError(null);
      setExceptionDate('');
      setBanner(
        data.replanQueued
          ? tc('calendar.exceptions.recalculating')
          : (data.replanned ?? 0) > 0
            ? tc('calendar.exceptions.savedReplanned', { count: data.replanned })
            : tc('calendar.exceptions.saved'),
      );
      await queryClient.invalidateQueries({ queryKey: ['scheduling-calendar-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['scheduling-calendar'] });
    },
    onError: (err) => setCalendarError(mutationErrorMessage(err)),
  });

  const deleteExceptionMutation = useMutation({
    mutationFn: (date: string) =>
      apiFetch<{ replanned?: number; replanQueued?: boolean }>(
        `/api/v1/scheduling/calendar-settings/exceptions/${encodeURIComponent(date.slice(0, 10))}`,
        { method: 'DELETE' },
      ),
    onSuccess: async (data) => {
      setCalendarError(null);
      setBanner(
        data.replanQueued
          ? tc('calendar.exceptions.clearedRecalculating')
          : (data.replanned ?? 0) > 0
            ? tc('calendar.exceptions.clearedReplanned', { count: data.replanned })
            : tc('calendar.exceptions.cleared'),
      );
      await queryClient.invalidateQueries({ queryKey: ['scheduling-calendar-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['scheduling-calendar'] });
    },
    onError: (err) => setCalendarError(mutationErrorMessage(err)),
  });

  function toggleWeekday(day: number) {
    setWorkingWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function configuredBadge(configured?: boolean) {
    return configured ? tc('integrationConfigured') : tc('integrationNotConfigured');
  }

  if (settingsQuery.isLoading || !companyForm || !integrationsForm) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <ErrorState
        title={tc('settings')}
        description={tCommon('loadFailed')}
        onRetry={() => settingsQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title={tc('settings')}
        tone="soft"
        actions={
          <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {tCommon('save')}
          </Button>
        }
      />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card title={tc('company')}>
        <div className="maher-form-section grid gap-3 sm:grid-cols-2">
          <Input
            label={tc('nameAr')}
            value={companyForm.nameAr}
            onChange={(e) => setCompanyForm({ ...companyForm, nameAr: e.target.value })}
          />
          <Input
            label={tc('nameEn')}
            value={companyForm.nameEn}
            onChange={(e) => setCompanyForm({ ...companyForm, nameEn: e.target.value })}
          />
          <Input
            label={tc('phone')}
            value={companyForm.phone}
            onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
          />
          <Input
            label={tc('email')}
            value={companyForm.email}
            onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
          />
          <Input
            label={tCommon('address')}
            value={companyForm.address}
            onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
          />
          <Input
            label={tc('currencyLabel')}
            value={companyForm.currency}
            onChange={(e) => setCompanyForm({ ...companyForm, currency: e.target.value })}
          />
          <Input
            label={tc('defaultVat')}
            type="number"
            value={String(companyForm.defaultVatPercent)}
            onChange={(e) =>
              setCompanyForm({ ...companyForm, defaultVatPercent: Number(e.target.value) })
            }
          />
          <Input
            label={tc('timezone')}
            value={companyForm.timezone}
            onChange={(e) => setCompanyForm({ ...companyForm, timezone: e.target.value })}
          />
          <Select
            label={tc('defaultLanguage')}
            value={companyForm.defaultLanguage}
            onChange={(e) => setCompanyForm({ ...companyForm, defaultLanguage: e.target.value })}
          >
            <option value="ar">العربية</option>
            <option value="en">English</option>
            <option value="he">עברית</option>
          </Select>
          <Input
            label={tc('quotationValidityDays')}
            type="number"
            value={String(companyForm.quotationValidityDays)}
            onChange={(e) =>
              setCompanyForm({ ...companyForm, quotationValidityDays: Number(e.target.value) })
            }
          />
          <Input
            label={tc('invoiceTermsDays')}
            type="number"
            value={String(companyForm.invoiceTermsDays)}
            onChange={(e) =>
              setCompanyForm({ ...companyForm, invoiceTermsDays: Number(e.target.value) })
            }
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={companyForm.lowStockAlertsEnabled}
              onChange={(e) =>
                setCompanyForm({ ...companyForm, lowStockAlertsEnabled: e.target.checked })
              }
            />
            {tc('lowStockAlerts')}
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={companyForm.autoReorderEnabled}
              onChange={(e) =>
                setCompanyForm({ ...companyForm, autoReorderEnabled: e.target.checked })
              }
            />
            {tc('autoReorderEnabled')}
          </label>
        </div>
      </Card>

      <Card title={tc('integrations')}>
        <p className="mb-4 text-sm text-[var(--maher-text-secondary)]">{tc('integrationsHint')}</p>
        <div className="maher-stagger grid gap-4 lg:grid-cols-2">
          <div className="maher-list-card rounded border border-[var(--maher-border)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{tc('integrationJoFotara')}</h3>
              <span className="text-xs text-[var(--maher-text-secondary)]">
                {configuredBadge(integrationsForm.jofotaraConfigured)}
              </span>
            </div>
            <Input
              label={tc('jofotaraBaseUrl')}
              value={integrationsForm.jofotaraBaseUrl ?? ''}
              onChange={(e) =>
                setIntegrationsForm({ ...integrationsForm, jofotaraBaseUrl: e.target.value })
              }
              dir="ltr"
              hint={tc('integrationSecretsEnvHint')}
            />
          </div>

          <div className="maher-list-card rounded border border-[var(--maher-border)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{tc('integrationWhatsApp')}</h3>
              <span className="text-xs text-[var(--maher-text-secondary)]">
                {configuredBadge(integrationsForm.whatsappLiveConfigured)}
              </span>
            </div>
            <Select
              label={tc('provider')}
              value={integrationsForm.whatsappProvider}
              onChange={(e) =>
                setIntegrationsForm({ ...integrationsForm, whatsappProvider: e.target.value })
              }
            >
              {PROVIDER_OPTIONS.whatsapp.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <p className="text-xs text-[var(--maher-text-secondary)]">
              {tc('whatsappInboundStatus')}:{' '}
              {configuredBadge(integrationsForm.whatsappInboundConfigured)}
            </p>
            <p className="text-xs text-[var(--maher-text-secondary)]">
              {tc('emailInboundStatus')}:{' '}
              {configuredBadge(integrationsForm.emailInboundConfigured)}
            </p>
            <Select
              label={tc('smsProvider')}
              value={integrationsForm.smsProvider ?? 'console'}
              onChange={(e) =>
                setIntegrationsForm({ ...integrationsForm, smsProvider: e.target.value })
              }
            >
              {PROVIDER_OPTIONS.sms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <p className="text-xs text-[var(--maher-text-secondary)]">
              {tc('smsLiveStatus')}: {configuredBadge(integrationsForm.smsLiveConfigured)}
            </p>
          </div>

          <div className="maher-list-card rounded border border-[var(--maher-border)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{tc('integrationSmtp')}</h3>
              <span className="text-xs text-[var(--maher-text-secondary)]">
                {configuredBadge(integrationsForm.smtpConfigured)}
              </span>
            </div>
            <Select
              label={tc('emailProvider')}
              value={integrationsForm.emailProvider}
              onChange={(e) =>
                setIntegrationsForm({ ...integrationsForm, emailProvider: e.target.value })
              }
            >
              {PROVIDER_OPTIONS.email.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Input
              label={tc('smtpFrom')}
              value={integrationsForm.smtpFrom ?? ''}
              onChange={(e) =>
                setIntegrationsForm({ ...integrationsForm, smtpFrom: e.target.value })
              }
              dir="ltr"
              hint={tc('integrationSecretsEnvHint')}
            />
          </div>

          <div className="maher-list-card rounded border border-[var(--maher-border)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{tc('integrationOpenAi')}</h3>
              <span className="text-xs text-[var(--maher-text-secondary)]">
                {configuredBadge(integrationsForm.openaiConfigured)}
              </span>
            </div>
            <Select
              label={tc('aiProvider')}
              value={integrationsForm.aiProvider}
              onChange={(e) =>
                setIntegrationsForm({ ...integrationsForm, aiProvider: e.target.value })
              }
            >
              {PROVIDER_OPTIONS.ai.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Select
              label={tc('ocrProvider')}
              value={integrationsForm.ocrProvider}
              onChange={(e) =>
                setIntegrationsForm({ ...integrationsForm, ocrProvider: e.target.value })
              }
            >
              {PROVIDER_OPTIONS.ocr.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <p className="text-xs text-[var(--maher-text-secondary)]">
              {tc('ocrLiveStatus')}: {configuredBadge(integrationsForm.ocrLiveConfigured)}
            </p>
            <p className="text-xs text-[var(--maher-text-secondary)]">
              {tc('ocrLocalStatus')}: {configuredBadge(integrationsForm.ocrLocalConfigured)}
            </p>
            <p className="text-xs text-[var(--maher-text-secondary)]">
              {tc('storageProviderStatus')}: {integrationsForm.storageProvider ?? 'local'} (
              {configuredBadge(integrationsForm.s3Configured)})
            </p>
            <p className="text-xs text-[var(--maher-text-secondary)]">
              {tc('mapsProviderStatus')}: {integrationsForm.mapsProvider ?? 'nominatim'}
            </p>
          </div>
        </div>
      </Card>

      <Card title={tAuth('mfaSetup')}>
        <div className="space-y-3">
          <p className="text-sm text-[var(--maher-text-secondary)]">{tAuth('mfaSetupHint')}</p>
          <p className="text-sm">
            {meQuery.data?.mfaEnabled ? tAuth('mfaEnabled') : tAuth('mfaDisabled')}
            {meQuery.data?.mfaPending ? ' (pending confirm)' : ''}
          </p>
          {mfaOtpauth ? (
            <div className="space-y-2 rounded-md border border-border p-3 text-xs break-all" dir="ltr">
              <p>
                {tAuth('mfaSecret')}: {mfaSecret}
              </p>
              <p>{mfaOtpauth}</p>
              <Input
                label={tAuth('mfaCode')}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
              />
              <Button
                loading={mfaConfirmMutation.isPending}
                onClick={() => mfaConfirmMutation.mutate()}
              >
                {tAuth('mfaConfirm')}
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {!meQuery.data?.mfaEnabled ? (
              <Button
                variant="secondary"
                loading={mfaEnableMutation.isPending}
                onClick={() => mfaEnableMutation.mutate()}
              >
                {tAuth('mfaEnable')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                loading={mfaDisableMutation.isPending}
                onClick={() => mfaDisableMutation.mutate()}
              >
                {tAuth('mfaDisable')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card
        title={tc('productionCalendar')}
        description={tc('productionCalendarHint')}
        actions={
          <Button
            size="sm"
            loading={saveCalendarMutation.isPending}
            onClick={() => saveCalendarMutation.mutate()}
          >
            {tCommon('save')}
          </Button>
        }
      >
        <div className="space-y-4">
          {calendarError ? <Alert variant="error">{calendarError}</Alert> : null}
          {calendarSettingsQuery.isError ? (
            <p className="text-xs text-[var(--maher-text-secondary)]">
              {tc('productionCalendarUnavailableHint')}
            </p>
          ) : null}
          <div className="maher-form-section grid gap-3 sm:grid-cols-2">
            <Input
              label={tc('timezone')}
              value={calendarTimezone}
              onChange={(e) => setCalendarTimezone(e.target.value)}
              dir="ltr"
            />
            <Input
              label={tc('shiftStart')}
              type="time"
              dir="ltr"
              value={shiftStart}
              onChange={(e) => setShiftStart(e.target.value)}
            />
            <Input
              label={tc('shiftEnd')}
              type="time"
              dir="ltr"
              value={shiftEnd}
              onChange={(e) => setShiftEnd(e.target.value)}
            />
            <Input
              label={tc('deliveryBufferWorkingDays')}
              type="number"
              min={0}
              max={10}
              dir="ltr"
              value={String(deliveryBufferWorkingDays)}
              onChange={(e) => setDeliveryBufferWorkingDays(Number(e.target.value) || 0)}
            />
          </div>
          <p className="-mt-1 text-xs text-[var(--maher-text-secondary)]">
            {tc('deliveryBufferWorkingDaysHint')}
          </p>
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--maher-text-primary)]">
              {tc('workingWeekdays')}
            </p>
            <p className="mb-2 text-xs text-[var(--maher-text-secondary)]">
              {tc('calendar.workingDaysHint')}
            </p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_KEYS.map((key, day) => {
                const checked = workingWeekdays.includes(day);
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      checked
                        ? 'border-brand bg-[var(--maher-brand-soft)] text-brand'
                        : 'border-[var(--maher-border)] bg-[var(--maher-surface)] text-[var(--maher-text-secondary)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-[var(--maher-brand)]"
                      checked={checked}
                      onChange={() => toggleWeekday(day)}
                    />
                    {tc(`weekdayShort.${key}`)}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 border-t border-[var(--maher-border)] pt-4">
            <div>
              <p className="text-sm font-medium text-[var(--maher-text-primary)]">
                {tc('calendar.exceptions.title')}
              </p>
              <p className="text-xs text-[var(--maher-text-secondary)]">
                {tc('calendar.exceptions.hint')}
              </p>
            </div>
            <div className="maher-form-section grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label={tc('calendar.exceptions.date')}
                type="date"
                dir="ltr"
                value={exceptionDate}
                onChange={(e) => setExceptionDate(e.target.value)}
              />
              <Select
                label={tc('calendar.exceptions.action')}
                value={exceptionAction}
                onChange={(e) =>
                  setExceptionAction(e.target.value as 'open' | 'close' | 'overtime')
                }
                options={[
                  { value: 'open', label: tc('calendar.exceptions.open') },
                  { value: 'close', label: tc('calendar.exceptions.close') },
                  { value: 'overtime', label: tc('calendar.exceptions.overtime') },
                ]}
              />
              {exceptionAction === 'overtime' ? (
                <Input
                  label={tc('calendar.exceptions.overtimeUntil')}
                  type="time"
                  dir="ltr"
                  value={overtimeEnd}
                  onChange={(e) => setOvertimeEnd(e.target.value)}
                />
              ) : (
                <div />
              )}
              <div className="flex items-end">
                <Button
                  size="sm"
                  loading={addExceptionMutation.isPending}
                  onClick={() => addExceptionMutation.mutate()}
                >
                  {tc('calendar.exceptions.apply')}
                </Button>
              </div>
            </div>
            <ul className="space-y-2">
              {(calendarSettingsQuery.data?.exceptions ?? []).length === 0 ? (
                <li className="text-xs text-[var(--maher-text-secondary)]">
                  {tc('calendar.exceptions.empty')}
                </li>
              ) : (
                (calendarSettingsQuery.data?.exceptions ?? []).map((ex) => {
                  const date = String(ex.date).slice(0, 10);
                  const label =
                    ex.type === 'EXTRA_SHIFT' &&
                    ex.shiftEnd &&
                    ex.shiftEnd > (calendarSettingsQuery.data?.shiftEnd ?? '16:00')
                      ? tc('calendar.exceptions.typeOvertime', {
                          start: ex.shiftStart ?? shiftStart,
                          end: ex.shiftEnd,
                        })
                      : ex.type === 'EXTRA_SHIFT'
                        ? tc('calendar.exceptions.typeOpen')
                        : tc('calendar.exceptions.typeClosed');
                  return (
                    <li
                      key={ex.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--maher-border)] bg-[var(--maher-surface)] px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-[var(--maher-text-primary)]" dir="ltr">
                        {date} — {label}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={deleteExceptionMutation.isPending}
                        onClick={() => deleteExceptionMutation.mutate(date)}
                      >
                        {tc('calendar.exceptions.clear')}
                      </Button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
