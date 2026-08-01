'use client';

import { PageHeader } from '@/components/admin/page-header';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Alert, Button, Card, ErrorState, Input, Select, Skeleton } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

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
  phone: string;
  email: string;
  address: string;
}

interface IntegrationsSettings {
  emailProvider: string;
  whatsappProvider: string;
  aiProvider: string;
  ocrProvider: string;
  jofotaraConfigured?: boolean;
  smtpConfigured?: boolean;
  openaiConfigured?: boolean;
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
  ai: ['mock', 'openai'],
  ocr: ['mock', 'http'],
} as const;

export default function SettingsPage() {
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [companyForm, setCompanyForm] = useState<CompanySettings | null>(null);
  const [integrationsForm, setIntegrationsForm] = useState<IntegrationsSettings | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<SettingsMap>('/api/v1/settings'),
  });

  useEffect(() => {
    if (settingsQuery.data?.company) setCompanyForm(settingsQuery.data.company);
    if (settingsQuery.data?.integrations) setIntegrationsForm(settingsQuery.data.integrations);
  }, [settingsQuery.data]);

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
      <PageHeader
        title={tc('settings')}
        actions={
          <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {tCommon('save')}
          </Button>
        }
      />
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card title={tc('company')}>
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
      </Card>

      <Card title={tc('integrations')}>
        <p className="mb-4 text-sm text-[var(--maher-text-secondary)]">{tc('integrationsHint')}</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-[var(--maher-border)] p-4 space-y-3">
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

          <div className="rounded border border-[var(--maher-border)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{tc('integrationWhatsApp')}</h3>
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
          </div>

          <div className="rounded border border-[var(--maher-border)] p-4 space-y-3">
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

          <div className="rounded border border-[var(--maher-border)] p-4 space-y-3">
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
          </div>
        </div>
      </Card>
    </div>
  );
}
