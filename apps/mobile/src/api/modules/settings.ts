import type { Locale } from '@maher/types';
import { apiGet, apiPatch } from '../client';

export type CompanySettings = {
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
  supportedLanguages?: Locale[];
};

export type IntegrationsSettings = {
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
};

export type SettingsMap = {
  company?: CompanySettings;
  integrations?: IntegrationsSettings;
  [key: string]: unknown;
};

export async function getSettings(): Promise<SettingsMap> {
  return apiGet<SettingsMap>('/settings');
}

export async function patchCompanySettings(
  company: CompanySettings,
): Promise<SettingsMap> {
  return apiPatch<SettingsMap>('/settings', { company });
}

export async function patchIntegrationsSettings(
  integrations: IntegrationsSettings,
): Promise<SettingsMap> {
  return apiPatch<SettingsMap>('/settings', { integrations });
}
