import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@maher/types';

class UpsertSettingDto {
  @IsObject()
  value!: Record<string, unknown>;
}

class PatchSettingsDto {
  @IsOptional()
  @IsObject()
  company?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  integrations?: Record<string, unknown>;
}

const COMPANY_DEFAULTS = {
  nameAr: 'مفروشات ماهر الأغبر وأولاده',
  nameEn: 'Maher Al-Aghbar & Sons Furniture',
  currency: 'JOD',
  defaultVatPercent: 16,
  timezone: 'Asia/Amman',
  defaultLanguage: 'ar',
  supportedLanguages: ['ar', 'en', 'he'],
  quotationValidityDays: 14,
  invoiceTermsDays: 30,
  lowStockAlertsEnabled: true,
  phone: '',
  email: '',
  address: '',
};

const INTEGRATION_DEFAULTS = {
  emailProvider: process.env.EMAIL_PROVIDER ?? 'console',
  whatsappProvider: process.env.WHATSAPP_PROVIDER ?? 'console',
  aiProvider: process.env.AI_PROVIDER ?? 'mock',
  ocrProvider: process.env.OCR_PROVIDER ?? 'mock',
  jofotaraConfigured: Boolean(
    process.env.JOFOTARA_CLIENT_ID?.trim() && process.env.JOFOTARA_SECRET_KEY?.trim(),
  ),
  smtpConfigured: Boolean(process.env.SMTP_URL?.trim()),
  openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
};

const SECRET_KEYS = new Set([
  'smtpPassword',
  'apiKey',
  'secretKey',
  'whatsappToken',
  'openaiKey',
  'jofotaraSecretKey',
  'clientSecret',
]);

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('settings.manage')
  async list() {
    const rows = await this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
    const map: Record<string, unknown> = {
      company: COMPANY_DEFAULTS,
      integrations: INTEGRATION_DEFAULTS,
    };
    for (const row of rows) {
      map[row.key] = this.sanitize(row.value);
    }
    if (!map.company || typeof map.company !== 'object') {
      map.company = COMPANY_DEFAULTS;
    } else {
      map.company = { ...COMPANY_DEFAULTS, ...(map.company as object) };
    }
    if (!map.integrations || typeof map.integrations !== 'object') {
      map.integrations = INTEGRATION_DEFAULTS;
    } else {
      map.integrations = { ...INTEGRATION_DEFAULTS, ...(map.integrations as object) };
    }
    return map;
  }

  @Patch()
  @RequirePermissions('settings.manage')
  async patch(@Body() dto: PatchSettingsDto, @CurrentUser() user: AuthUser) {
    const updates: Array<{ key: string; value: Record<string, unknown> }> = [];

    if (dto.company && typeof dto.company === 'object') {
      updates.push({ key: 'company', value: dto.company });
    }
    if (dto.integrations && typeof dto.integrations === 'object') {
      updates.push({ key: 'integrations', value: dto.integrations });
    }

    if (updates.length === 0) {
      return this.list();
    }

    const results: Record<string, unknown> = {};
    for (const { key, value } of updates) {
      const existing = await this.prisma.systemSetting.findUnique({ where: { key } });
      const merged: Record<string, unknown> = {
        ...((existing?.value as object) ?? {}),
        ...this.stripSecrets(value),
      };
      if (key === 'company') {
        Object.assign(merged, { ...COMPANY_DEFAULTS, ...merged });
      }
      if (key === 'integrations') {
        Object.assign(merged, { ...INTEGRATION_DEFAULTS, ...merged });
      }

      const row = await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value: merged as Prisma.InputJsonValue, updatedById: user.id },
        update: { value: merged as Prisma.InputJsonValue, updatedById: user.id },
      });
      await this.prisma.auditEvent.create({
        data: {
          userId: user.id,
          action: 'settings.patch',
          entityType: 'SystemSetting',
          entityId: row.id,
          newValues: { key, value: this.sanitize(merged) } as Prisma.InputJsonValue,
        },
      });
      results[key] = this.sanitize(row.value);
    }

    return results;
  }

  @Get(':key')
  @RequirePermissions('settings.manage')
  async get(@Param('key') key: string) {
    if (key === 'company') {
      const row = await this.prisma.systemSetting.findUnique({ where: { key: 'company' } });
      return { key: 'company', value: { ...COMPANY_DEFAULTS, ...((row?.value as object) ?? {}) } };
    }
    if (key === 'integrations') {
      const row = await this.prisma.systemSetting.findUnique({ where: { key: 'integrations' } });
      return {
        key: 'integrations',
        value: { ...INTEGRATION_DEFAULTS, ...((row?.value as object) ?? {}) },
      };
    }
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return { key, value: this.sanitize(row?.value ?? null) };
  }

  @Put(':key')
  @RequirePermissions('settings.manage')
  async upsert(
    @Param('key') key: string,
    @Body() dto: UpsertSettingDto,
    @CurrentUser() user: AuthUser,
  ) {
    const safeValue = this.stripSecrets(dto.value);
    const row = await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: safeValue as Prisma.InputJsonValue, updatedById: user.id },
      update: { value: safeValue as Prisma.InputJsonValue, updatedById: user.id },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'settings.update',
        entityType: 'SystemSetting',
        entityId: row.id,
        newValues: { key, value: this.sanitize(safeValue) } as Prisma.InputJsonValue,
      },
    });
    return { key: row.key, value: this.sanitize(row.value) };
  }

  private sanitize(value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.has(k) ? undefined : v;
    }
    return out;
  }

  private stripSecrets(value: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEYS.has(k)) continue;
      out[k] = v;
    }
    return out;
  }
}
