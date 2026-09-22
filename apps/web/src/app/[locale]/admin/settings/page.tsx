'use client';

import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import type { FactoryCalendarSettings } from '@/lib/scheduling';
import {
  Alert,
  Board,
  BoardSkeleton,
  Button,
  DateField,
  ErrorBoard,
  FormFooter,
  FormSection,
  Input,
  Ledger,
  LedgerRow,
  Ltr,
  MonthCalendar,
  NumberField,
  QrDisplay,
  SectionTabs,
  SegmentedControl,
  Select,
  Stamp,
  Switch,
  TextArea,
  type DayMeta,
} from '@maher/ui';
import { useKitCopy } from '@/lib/kit-copy';
import { CalendarDays, Building2, Plug, ShieldCheck } from 'lucide-react';
import { renderWhatsAppTemplate } from '@/lib/low-stock-review';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

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
}

type PurchasingWhatsAppSettings = {
  template: string;
  includePrices: boolean;
  includeWarehouse: boolean;
  includeExpectedDate: boolean;
  signature: string;
};

type SettingsMap = Record<string, unknown> & {
  company?: CompanySettings;
  integrations?: IntegrationsSettings;
  purchasingWhatsApp?: PurchasingWhatsAppSettings;
};

const EMPTY_WHATSAPP: PurchasingWhatsAppSettings = {
  template: '',
  includePrices: false,
  includeWarehouse: false,
  includeExpectedDate: true,
  signature: '',
};

const PROVIDER_OPTIONS = {
  email: ['console', 'smtp'],
  whatsapp: ['console', 'twilio', 'meta'],
  sms: ['console', 'twilio'],
  ai: ['mock', 'openai'],
  ocr: ['mock', 'local', 'tesseract', 'openai', 'http'],
} as const;

type SettingsTab = 'company' | 'calendar' | 'integrations' | 'security';

export default function SettingsPage() {
  const tc = useTranslations('catalog');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const kit = useKitCopy();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SettingsTab>('company');
  const today = new Date();
  const [calCursor, setCalCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [companyForm, setCompanyForm] = useState<CompanySettings | null>(null);
  const [integrationsForm, setIntegrationsForm] = useState<IntegrationsSettings | null>(null);
  const [whatsappForm, setWhatsappForm] = useState<PurchasingWhatsAppSettings>(EMPTY_WHATSAPP);
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
  const [maxProductionEarlyWorkingDays, setMaxProductionEarlyWorkingDays] = useState(10);
  const [targetFactoryUtilizationPercent, setTargetFactoryUtilizationPercent] = useState(85);
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
    if (settingsQuery.data?.purchasingWhatsApp) {
      setWhatsappForm({ ...EMPTY_WHATSAPP, ...settingsQuery.data.purchasingWhatsApp });
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    const cal = calendarSettingsQuery.data;
    if (!cal) return;
    setCalendarTimezone(cal.timezone);
    setWorkingWeekdays(cal.workingWeekdays ?? [0, 1, 2, 3, 4, 6]);
    setShiftStart(cal.shiftStart);
    setShiftEnd(cal.shiftEnd);
    setDeliveryBufferWorkingDays(cal.deliveryBufferWorkingDays ?? 1);
    setMaxProductionEarlyWorkingDays(cal.maxProductionEarlyWorkingDays ?? 10);
    setTargetFactoryUtilizationPercent(cal.targetFactoryUtilizationPercent ?? 85);
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
          purchasingWhatsApp: whatsappForm,
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
          maxProductionEarlyWorkingDays,
          targetFactoryUtilizationPercent,
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

  const exceptions = useMemo(() => calendarSettingsQuery.data?.exceptions ?? [], [calendarSettingsQuery.data?.exceptions]);
  const calendarDayMeta = useMemo<Record<string, DayMeta>>(() => {
    const meta: Record<string, DayMeta> = {};
    const first = new Date(calCursor.y, calCursor.m, 1);
    const last = new Date(calCursor.y, calCursor.m + 1, 0);
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      meta[ymd] = workingWeekdays.includes(d.getDay()) ? { tone: 'available' } : { tone: 'closed' };
    }
    for (const ex of exceptions) {
      const ymd = String(ex.date).slice(0, 10);
      if (ex.type === 'EXTRA_SHIFT') {
        const overtime = Boolean(ex.shiftEnd && ex.shiftEnd > (calendarSettingsQuery.data?.shiftEnd ?? shiftEnd));
        meta[ymd] = { tone: overtime ? 'busy' : 'available', markers: ['confirmed'] };
      } else {
        meta[ymd] = { tone: 'closed', markers: ['attention'] };
      }
    }
    return meta;
  }, [calCursor, workingWeekdays, exceptions, calendarSettingsQuery.data?.shiftEnd, shiftEnd]);

  function configuredBadge(configured?: boolean) {
    return (
      <Stamp tone={configured ? 'success' : 'neutral'} size="sm">
        {configured ? tc('integrationConfigured') : tc('integrationNotConfigured')}
      </Stamp>
    );
  }

  if (settingsQuery.isLoading || !companyForm || !integrationsForm) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} />
        <BoardSkeleton rows={6} />
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <ErrorBoard
        title={tc('settings')}
        description={tCommon('loadFailed')}
        onRetry={() => settingsQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const workingDaysThisMonth = Object.values(calendarDayMeta).filter((m) => m.tone !== 'closed').length;
  const closedDaysThisMonth = Object.values(calendarDayMeta).length - workingDaysThisMonth;

  const tabs = [
    { id: 'company', label: tc('company'), icon: <Building2 className="h-4 w-4" /> },
    { id: 'calendar', label: tc('productionCalendar'), icon: <CalendarDays className="h-4 w-4" /> },
    { id: 'integrations', label: tc('integrations'), icon: <Plug className="h-4 w-4" /> },
    { id: 'security', label: tAuth('mfaSetup'), icon: <ShieldCheck className="h-4 w-4" /> },
  ];

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="brand" wash="top" as="section">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{tc('settings')}</h1>
            <p className="mt-1 text-[14px] leading-5 text-[var(--maher-text-secondary)]">{companyForm.nameEn || companyForm.nameAr}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Stamp tone={meQuery.data?.mfaEnabled ? 'success' : 'neutral'} size="sm">{meQuery.data?.mfaEnabled ? tAuth('mfaEnabled') : tAuth('mfaDisabled')}</Stamp>
            <Stamp tone="info" size="sm"><Ltr>{companyForm.currency}</Ltr></Stamp>
            <Stamp tone="info" size="sm"><Ltr>{companyForm.timezone}</Ltr></Stamp>
          </div>
        </div>
      </Board>

      <SectionTabs aria-label={tc('settings')} items={tabs} value={tab} onChange={(id) => setTab(id as SettingsTab)} />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {tab === 'company' ? (
        <div className="space-y-5">
          <FormSection title={tc('company')} description={companyForm.address || undefined}>
            <Input label={tc('nameAr')} value={companyForm.nameAr} onChange={(e) => setCompanyForm({ ...companyForm, nameAr: e.target.value })} dir="rtl" />
            <Input label={tc('nameEn')} value={companyForm.nameEn} onChange={(e) => setCompanyForm({ ...companyForm, nameEn: e.target.value })} dir="ltr" />
            <Input label={tc('phone')} value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} dir="ltr" inputMode="tel" />
            <Input label={tc('email')} value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} dir="ltr" inputMode="email" />
            <Input className="md:col-span-2" label={tCommon('address')} value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} />
          </FormSection>
          <FormSection title={tc('defaultLanguage')} description={tc('timezone')} columns={3}>
            <Input label={tc('currencyLabel')} value={companyForm.currency} onChange={(e) => setCompanyForm({ ...companyForm, currency: e.target.value })} dir="ltr" />
            <NumberField label={tc('defaultVat')} unit="%" value={companyForm.defaultVatPercent} onChange={(v) => setCompanyForm({ ...companyForm, defaultVatPercent: v ?? 0 })} min={0} max={100} />
            <Input label={tc('timezone')} value={companyForm.timezone} onChange={(e) => setCompanyForm({ ...companyForm, timezone: e.target.value })} dir="ltr" />
            <Select label={tc('defaultLanguage')} value={companyForm.defaultLanguage} onChange={(e) => setCompanyForm({ ...companyForm, defaultLanguage: e.target.value })}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
              <option value="he">עברית</option>
            </Select>
            <NumberField label={tc('quotationValidityDays')} value={companyForm.quotationValidityDays} onChange={(v) => setCompanyForm({ ...companyForm, quotationValidityDays: v ?? 0 })} min={0} />
            <NumberField label={tc('invoiceTermsDays')} value={companyForm.invoiceTermsDays} onChange={(v) => setCompanyForm({ ...companyForm, invoiceTermsDays: v ?? 0 })} min={0} />
          </FormSection>
          <FormSection title={tc('lowStockAlerts')} columns={1} tone="warning">
            <Switch label={tc('lowStockAlerts')} checked={companyForm.lowStockAlertsEnabled} onChange={(checked) => setCompanyForm({ ...companyForm, lowStockAlertsEnabled: checked })} />
            <Switch label={tc('autoReorderEnabled')} checked={companyForm.autoReorderEnabled} onChange={(checked) => setCompanyForm({ ...companyForm, autoReorderEnabled: checked })} />
          </FormSection>
          <FormFooter primary={<Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>{tCommon('save')}</Button>} error={error} />
        </div>
      ) : null}

      {tab === 'calendar' ? (
        <div className="space-y-5">
          {calendarError ? <Alert variant="error">{calendarError}</Alert> : null}
          {calendarSettingsQuery.isError ? <Alert variant="warning">{tc('productionCalendarUnavailableHint')}</Alert> : null}
          <div className="grid gap-5 xl:grid-cols-12">
            <div className="space-y-5 xl:col-span-7">
              <FormSection title={tc('productionCalendar')} description={tc('productionCalendarHint')} columns={3}>
                <Input label={tc('timezone')} value={calendarTimezone} onChange={(e) => setCalendarTimezone(e.target.value)} dir="ltr" />
                <Input label={tc('shiftStart')} type="time" dir="ltr" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
                <Input label={tc('shiftEnd')} type="time" dir="ltr" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
                <NumberField label={tc('deliveryBufferWorkingDays')} hint={tc('deliveryBufferWorkingDaysHint')} value={deliveryBufferWorkingDays} onChange={(v) => setDeliveryBufferWorkingDays(v ?? 0)} min={0} max={10} />
                <NumberField label={tc('maxProductionEarlyWorkingDays')} hint={tc('maxProductionEarlyWorkingDaysHint')} value={maxProductionEarlyWorkingDays} onChange={(v) => setMaxProductionEarlyWorkingDays(v ?? 0)} min={0} max={60} />
                <NumberField label={tc('targetFactoryUtilizationPercent')} hint={tc('targetFactoryUtilizationPercentHint')} unit="%" value={targetFactoryUtilizationPercent} onChange={(v) => setTargetFactoryUtilizationPercent(v ?? 85)} min={1} max={100} />
              </FormSection>
              <FormSection title={tc('workingWeekdays')} description={tc('calendar.workingDaysHint')} columns={1}>
                <div className="flex flex-wrap gap-2" role="group" aria-label={tc('workingWeekdays')}>
                  {WEEKDAY_KEYS.map((key, day) => {
                    const checked = workingWeekdays.includes(day);
                    return (
                      <button
                        key={key}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggleWeekday(day)}
                        className={`flex h-10 min-w-[3.25rem] items-center justify-center rounded-full border px-4 text-[13px] font-semibold transition ${
                          checked
                            ? 'border-[var(--maher-text-primary)] bg-[var(--maher-text-primary)] text-[var(--maher-surface)]'
                            : 'border-[var(--maher-border)] bg-[var(--maher-surface)] text-[var(--maher-text-secondary)] hover:border-[var(--maher-brand)]'
                        }`}
                      >
                        {tc(`weekdayShort.${key}`)}
                      </button>
                    );
                  })}
                </div>
              </FormSection>
              <FormSection title={tc('calendar.exceptions.title')} description={tc('calendar.exceptions.hint')} columns={3} tone="info">
                <DateField label={tc('calendar.exceptions.date')} value={exceptionDate} onChange={setExceptionDate} copy={kit.date} locale={locale} dayMeta={calendarDayMeta} todayShortcut presentation="popover" />
                <div className="md:col-span-2">
                  <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tc('calendar.exceptions.action')}</span>
                  <SegmentedControl<'open' | 'close' | 'overtime'>
                    fill
                    value={exceptionAction}
                    onChange={setExceptionAction}
                    options={[
                      { value: 'open', label: tc('calendar.exceptions.open') },
                      { value: 'close', label: tc('calendar.exceptions.close') },
                      { value: 'overtime', label: tc('calendar.exceptions.overtime') },
                    ]}
                  />
                </div>
                {exceptionAction === 'overtime' ? (
                  <Input label={tc('calendar.exceptions.overtimeUntil')} type="time" dir="ltr" value={overtimeEnd} onChange={(e) => setOvertimeEnd(e.target.value)} />
                ) : null}
                <div className="flex items-end md:col-span-3">
                  <Button size="sm" disabled={!exceptionDate} loading={addExceptionMutation.isPending} onClick={() => addExceptionMutation.mutate()}>
                    {tc('calendar.exceptions.apply')}
                  </Button>
                </div>
                {exceptions.length ? (
                  <Ledger className="md:col-span-3">
                    {exceptions.map((ex) => {
                      const date = String(ex.date).slice(0, 10);
                      const overtime = ex.type === 'EXTRA_SHIFT' && ex.shiftEnd && ex.shiftEnd > (calendarSettingsQuery.data?.shiftEnd ?? '16:00');
                      const label = overtime
                        ? tc('calendar.exceptions.typeOvertime', { start: ex.shiftStart ?? shiftStart, end: ex.shiftEnd ?? '' })
                        : ex.type === 'EXTRA_SHIFT'
                          ? tc('calendar.exceptions.typeOpen')
                          : tc('calendar.exceptions.typeClosed');
                      return (
                        <LedgerRow
                          key={ex.id}
                          label={<Ltr>{new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T00:00:00`))}</Ltr>}
                          hint={label}
                          tone={ex.type === 'EXTRA_SHIFT' ? (overtime ? 'warning' : 'success') : 'error'}
                          stamp
                          value={
                            <Button size="sm" variant="ghost" loading={deleteExceptionMutation.isPending && deleteExceptionMutation.variables === date} onClick={() => deleteExceptionMutation.mutate(date)}>
                              {tc('calendar.exceptions.clear')}
                            </Button>
                          }
                        />
                      );
                    })}
                  </Ledger>
                ) : (
                  <p className="text-[13px] text-[var(--maher-text-tertiary)] md:col-span-3">{tc('calendar.exceptions.empty')}</p>
                )}
              </FormSection>
            </div>
            <div className="xl:col-span-5">
              <Board tone="brand" className="xl:sticky xl:top-24">
                <Board.Header
                  title={tc('productionCalendar')}
                  description={`${shiftStart}–${shiftEnd}`}
                  meta={
                    <span className="flex gap-1">
                      <Stamp tone="success" size="sm">{workingDaysThisMonth}</Stamp>
                      <Stamp tone="neutral" size="sm">{closedDaysThisMonth}</Stamp>
                    </span>
                  }
                />
                <Board.Body>
                  <MonthCalendar
                    embedded
                    variant="admin"
                    locale={locale}
                    monthCursor={calCursor}
                    onMonthChange={setCalCursor}
                    value={exceptionDate}
                    onSelect={setExceptionDate}
                    dayMeta={calendarDayMeta}
                    prevLabel={kit.date.prevMonth}
                    nextLabel={kit.date.nextMonth}
                  />
                </Board.Body>
                <Board.Footer>
                  <Button size="sm" loading={saveCalendarMutation.isPending} onClick={() => saveCalendarMutation.mutate()}>
                    {tCommon('save')}
                  </Button>
                </Board.Footer>
              </Board>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'integrations' ? (
        <div className="space-y-5">
          <p className="text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tc('integrationsHint')}</p>
          <div className="maher-stagger grid gap-5 lg:grid-cols-3">
            <Board tone={integrationsForm.whatsappLiveConfigured ? 'success' : 'neutral'}>
              <Board.Header title={tc('integrationWhatsApp')} meta={configuredBadge(integrationsForm.whatsappLiveConfigured)} />
              <Board.Body className="space-y-3">
                <Select label={tc('provider')} value={integrationsForm.whatsappProvider} onChange={(e) => setIntegrationsForm({ ...integrationsForm, whatsappProvider: e.target.value })}>
                  {PROVIDER_OPTIONS.whatsapp.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                <Select label={tc('smsProvider')} value={integrationsForm.smsProvider ?? 'console'} onChange={(e) => setIntegrationsForm({ ...integrationsForm, smsProvider: e.target.value })}>
                  {PROVIDER_OPTIONS.sms.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                <Ledger>
                  <LedgerRow label={tc('whatsappInboundStatus')} value={configuredBadge(integrationsForm.whatsappInboundConfigured)} />
                  <LedgerRow label={tc('emailInboundStatus')} value={configuredBadge(integrationsForm.emailInboundConfigured)} />
                  <LedgerRow label={tc('smsLiveStatus')} value={configuredBadge(integrationsForm.smsLiveConfigured)} />
                </Ledger>
              </Board.Body>
            </Board>
            <Board tone={integrationsForm.smtpConfigured ? 'success' : 'neutral'}>
              <Board.Header title={tc('integrationSmtp')} meta={configuredBadge(integrationsForm.smtpConfigured)} />
              <Board.Body className="space-y-3">
                <Select label={tc('emailProvider')} value={integrationsForm.emailProvider} onChange={(e) => setIntegrationsForm({ ...integrationsForm, emailProvider: e.target.value })}>
                  {PROVIDER_OPTIONS.email.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                <Input label={tc('smtpFrom')} value={integrationsForm.smtpFrom ?? ''} onChange={(e) => setIntegrationsForm({ ...integrationsForm, smtpFrom: e.target.value })} dir="ltr" hint={tc('integrationSecretsEnvHint')} />
              </Board.Body>
            </Board>
            <Board tone={integrationsForm.openaiConfigured ? 'success' : 'neutral'}>
              <Board.Header title={tc('integrationOpenAi')} meta={configuredBadge(integrationsForm.openaiConfigured)} />
              <Board.Body className="space-y-3">
                <Select label={tc('aiProvider')} value={integrationsForm.aiProvider} onChange={(e) => setIntegrationsForm({ ...integrationsForm, aiProvider: e.target.value })}>
                  {PROVIDER_OPTIONS.ai.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                <Select label={tc('ocrProvider')} value={integrationsForm.ocrProvider} onChange={(e) => setIntegrationsForm({ ...integrationsForm, ocrProvider: e.target.value })}>
                  {PROVIDER_OPTIONS.ocr.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                <Ledger>
                  <LedgerRow label={tc('ocrLiveStatus')} value={configuredBadge(integrationsForm.ocrLiveConfigured)} />
                  <LedgerRow label={tc('ocrLocalStatus')} value={configuredBadge(integrationsForm.ocrLocalConfigured)} />
                  <LedgerRow label={tc('storageProviderStatus')} hint={<Ltr>{integrationsForm.storageProvider ?? 'local'}</Ltr>} value={configuredBadge(integrationsForm.s3Configured)} />
                  <LedgerRow label={tc('mapsProviderStatus')} value={<Ltr>{integrationsForm.mapsProvider ?? 'nominatim'}</Ltr>} />
                </Ledger>
              </Board.Body>
            </Board>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <FormSection title={tc('purchasingWhatsApp')} description={tc('purchasingWhatsAppHint')} columns={1}>
              <TextArea label={tc('whatsappTemplate')} value={whatsappForm.template} onChange={(e) => setWhatsappForm({ ...whatsappForm, template: e.target.value })} rows={6} />
              <p className="-mt-2 text-[12px] text-[var(--maher-text-tertiary)]">{tc('templateTokens')}</p>
              <Input label={tc('signature')} value={whatsappForm.signature} onChange={(e) => setWhatsappForm({ ...whatsappForm, signature: e.target.value })} />
              <Switch label={tc('includePrices')} checked={whatsappForm.includePrices} onChange={(checked) => setWhatsappForm({ ...whatsappForm, includePrices: checked })} />
              <Switch label={tc('includeWarehouse')} checked={whatsappForm.includeWarehouse} onChange={(checked) => setWhatsappForm({ ...whatsappForm, includeWarehouse: checked })} />
              <Switch label={tc('includeExpectedDate')} checked={whatsappForm.includeExpectedDate} onChange={(checked) => setWhatsappForm({ ...whatsappForm, includeExpectedDate: checked })} />
            </FormSection>
            <Board variant="ink" tone="success">
              <Board.Header title={tc('whatsappPreview')} />
              <Board.Body>
                <pre className="whitespace-pre-wrap font-sans text-[14px] leading-6" dir="ltr">
                  {renderWhatsAppTemplate(
                    whatsappForm.template ||
                      'Hello {{supplierName}}\n{{orderNumber}}\n{{lines}}\n{{total}} {{currency}}\n{{expectedDate}}\n{{companyName}}\n{{signature}}',
                    {
                      supplierName: 'Marka',
                      orderNumber: 'PORD-1001',
                      lines: whatsappForm.includePrices ? 'Oak x 2 @ 12.00' : 'Oak x 2',
                      total: '24.00',
                      currency: companyForm.currency,
                      expectedDate: whatsappForm.includeExpectedDate ? '2026-09-20' : '',
                      companyName: companyForm.nameEn || companyForm.nameAr,
                      signature: whatsappForm.signature,
                    },
                  )}
                </pre>
              </Board.Body>
            </Board>
          </div>
          <FormFooter primary={<Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>{tCommon('save')}</Button>} error={error} />
        </div>
      ) : null}

      {tab === 'security' ? (
        <div className="grid gap-5 lg:grid-cols-12">
          <Board tone={meQuery.data?.mfaEnabled ? 'success' : 'warning'} wash="top" className="lg:col-span-7">
            <Board.Header
              title={tAuth('mfaSetup')}
              description={tAuth('mfaSetupHint')}
              meta={<Stamp tone={meQuery.data?.mfaEnabled ? 'success' : meQuery.data?.mfaPending ? 'warning' : 'neutral'} size="sm">{meQuery.data?.mfaEnabled ? tAuth('mfaEnabled') : meQuery.data?.mfaPending ? tAuth('mfaConfirm') : tAuth('mfaDisabled')}</Stamp>}
            />
            <Board.Body className="space-y-4">
              {mfaOtpauth ? (
                <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                  <QrDisplay value={mfaOtpauth} size={168} caption={tAuth('mfaSecret')} />
                  <div className="space-y-3">
                    <Ledger>
                      <LedgerRow label={tAuth('mfaSecret')} value={<Ltr wrap className="font-mono text-[12px]">{mfaSecret}</Ltr>} />
                    </Ledger>
                    <Input label={tAuth('mfaCode')} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} dir="ltr" inputMode="numeric" autoComplete="one-time-code" />
                    <Button loading={mfaConfirmMutation.isPending} onClick={() => mfaConfirmMutation.mutate()}>
                      {tAuth('mfaConfirm')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </Board.Body>
            <Board.Footer>
              {!meQuery.data?.mfaEnabled ? (
                <Button variant="secondary" loading={mfaEnableMutation.isPending} onClick={() => mfaEnableMutation.mutate()}>
                  {tAuth('mfaEnable')}
                </Button>
              ) : (
                <Button variant="secondary" loading={mfaDisableMutation.isPending} onClick={() => mfaDisableMutation.mutate()}>
                  {tAuth('mfaDisable')}
                </Button>
              )}
            </Board.Footer>
          </Board>
        </div>
      ) : null}
    </div>
  );
}
