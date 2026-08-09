import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { extname } from 'path';
import { memoryStorage } from 'multer';
import { DocumentVisibility } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { Public, RequireAnyPermissions, RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LocalStorageService } from '../../integrations/storage/local-storage.service';
import type { AuthUser } from '@maher/types';

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/** Catalog product images need durable public download links. */
const LONG_LIVED_TTL_SECONDS = 10 * 365 * 24 * 3600;

class UploadFromUrlDto {
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2000)
  url!: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

function mimeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

function tokenTtlForCategory(category: string | null | undefined): number {
  if (!category) return 900;
  if (
    category === 'PRODUCT_IMAGE' ||
    category === 'INVENTORY_IMAGE' ||
    category.startsWith('CATALOG')
  ) {
    return LONG_LIVED_TTL_SECONDS;
  }
  return 900;
}

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly storage: LocalStorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions('document.read')
  listDocuments(@CurrentUser() user: AuthUser) {
    return this.prisma.document.findMany({
      where: user.customerId
        ? {
            customerId: user.customerId,
            visibility: DocumentVisibility.CUSTOMER_VISIBLE,
            archivedAt: null,
          }
        : { archivedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  private async resolveProductionOrderId(
    productionOrderId: string | undefined,
    taskId: string | undefined,
  ) {
    if (productionOrderId) return productionOrderId;
    if (!taskId) return undefined;
    const task = await this.prisma.productionTask.findUnique({
      where: { id: taskId },
      select: { productionOrderId: true },
    });
    return task?.productionOrderId ?? undefined;
  }

  private async createDocument(params: {
    user: AuthUser;
    fileName: string;
    mimeType: string;
    stored: { key: string; sizeBytes: number };
    category?: string;
    visibility?: string;
    requestId?: string;
    productionOrderId?: string;
    taskId?: string;
    idempotencyKey?: string;
  }) {
    if (params.idempotencyKey) {
      const existing = await this.prisma.document.findFirst({
        where: {
          description: `idempotency:${params.idempotencyKey}`,
          archivedAt: null,
        },
      });
      if (existing) {
        const ttl = tokenTtlForCategory(existing.category);
        const token = this.storage.createAccessToken(existing.storageKey, ttl);
        return {
          document: existing,
          accessToken: token,
          downloadPath: `/api/v1/uploads/download?token=${token}`,
          expiresInSeconds: ttl,
          replayed: true,
        };
      }
    }

    const isCustomer = Boolean(params.user.customerId);
    const resolvedCategory =
      params.category ??
      (params.taskId
        ? `TASK_PHOTO:${params.taskId}`
        : isCustomer
          ? 'CUSTOMER_ATTACHMENT'
          : 'GENERAL');

    const resolvedProductionOrderId = await this.resolveProductionOrderId(
      params.productionOrderId,
      params.taskId,
    );

    const isProductImage = resolvedCategory === 'PRODUCT_IMAGE';

    const doc = await this.prisma.document.create({
      data: {
        fileName: params.fileName,
        mimeType: params.mimeType,
        sizeBytes: params.stored.sizeBytes,
        storageKey: params.stored.key,
        category: resolvedCategory,
        description: params.idempotencyKey
          ? `idempotency:${params.idempotencyKey}`
          : undefined,
        visibility: isCustomer || isProductImage
          ? DocumentVisibility.CUSTOMER_VISIBLE
          : ((params.visibility as DocumentVisibility | undefined) ?? DocumentVisibility.INTERNAL),
        uploadedById: params.user.id,
        customerId: params.user.customerId ?? undefined,
        requestId: params.requestId || undefined,
        productionOrderId: resolvedProductionOrderId,
      },
    });

    const ttl = tokenTtlForCategory(resolvedCategory);
    const token = this.storage.createAccessToken(params.stored.key, ttl);
    return {
      document: doc,
      accessToken: token,
      downloadPath: `/api/v1/uploads/download?token=${token}`,
      expiresInSeconds: ttl,
      replayed: false,
    };
  }

  @Post()
  @RequireAnyPermissions('document.manage', 'catalog.manage', 'inventory.adjust')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
    @Query('category') category?: string,
    @Query('visibility') visibility?: string,
    @Query('requestId') requestId?: string,
    @Query('productionOrderId') productionOrderId?: string,
    @Query('taskId') taskId?: string,
    @Query('idempotencyKey') idempotencyKey?: string,
  ) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'File required.' });
    if (!ALLOWED.has(file.mimetype)) {
      throw new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'File type not allowed.' });
    }

    const stored = await this.storage.putObject(file.originalname, file.mimetype, file.buffer);
    return this.createDocument({
      user,
      fileName: file.originalname,
      mimeType: file.mimetype,
      stored,
      category,
      visibility,
      requestId,
      productionOrderId,
      taskId,
      idempotencyKey,
    });
  }

  @Post('from-url')
  @RequireAnyPermissions('document.manage', 'catalog.manage', 'inventory.adjust')
  async uploadFromUrl(
    @Body() dto: UploadFromUrlDto,
    @CurrentUser() user: AuthUser,
    @Query('category') category?: string,
    @Query('visibility') visibility?: string,
    @Query('requestId') requestId?: string,
    @Query('productionOrderId') productionOrderId?: string,
    @Query('taskId') taskId?: string,
  ) {
    let parsed: URL;
    try {
      parsed = new URL(dto.url.trim());
    } catch {
      throw new BadRequestException({ code: 'INVALID_URL', message: 'Invalid image URL.' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException({ code: 'INVALID_URL', message: 'Only http(s) URLs are allowed.' });
    }

    let response: globalThis.Response;
    try {
      response = await fetch(parsed.toString(), {
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
        headers: { Accept: 'image/*,application/pdf,*/*' },
      });
    } catch {
      throw new BadRequestException({
        code: 'URL_FETCH_FAILED',
        message: 'Could not download the file from that URL.',
      });
    }

    if (!response.ok) {
      throw new BadRequestException({
        code: 'URL_FETCH_FAILED',
        message: `URL returned HTTP ${response.status}.`,
      });
    }

    const headerType = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase();
    let mimeType = headerType || '';
    if (!mimeType || mimeType === 'application/octet-stream') {
      mimeType = mimeFromKey(parsed.pathname) || 'image/jpeg';
    }
    if (!ALLOWED.has(mimeType) && !mimeType.startsWith('image/')) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'URL must point to an allowed image or document type.',
      });
    }
    if (mimeType.startsWith('image/') && !ALLOWED.has(mimeType)) {
      // Accept generic image/* when server sends unusual but still image types (e.g. image/jpg)
      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
      else if (!ALLOWED.has(mimeType)) {
        throw new BadRequestException({
          code: 'INVALID_FILE_TYPE',
          message: 'Image type is not allowed.',
        });
      }
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      throw new BadRequestException({ code: 'EMPTY_FILE', message: 'URL returned an empty file.' });
    }
    if (buffer.length > 15 * 1024 * 1024) {
      throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'File exceeds 15MB limit.' });
    }

    const pathName = parsed.pathname.split('/').pop() || '';
    const inferredExt = extname(pathName) || (mimeType.includes('png') ? '.png' : '.jpg');
    const fileName =
      (dto.fileName?.trim() || pathName || `from-url${inferredExt}`).slice(0, 180) ||
      `from-url${inferredExt}`;

    const stored = await this.storage.putObject(fileName, mimeType, buffer);
    return this.createDocument({
      user,
      fileName,
      mimeType,
      stored,
      category,
      visibility,
      requestId,
      productionOrderId,
      taskId,
    });
  }

  @Public()
  @Get('download')
  async download(@Query('token') token: string, @Res() res: Response) {
    if (!token) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'token required' });
    const key = this.storage.verifyAccessToken(token);
    const stream = await this.storage.getObjectStream(key);
    const mime = mimeFromKey(key);
    const fileName = key.split('/').pop() ?? 'file';
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      mime.startsWith('image/')
        ? `inline; filename="${fileName}"`
        : `attachment; filename="${fileName}"`,
    );
    stream.pipe(res);
  }

  @Get('documents/:id/link')
  @RequirePermissions('document.read')
  async link(@Param('id') id: string) {
    const doc = await this.prisma.document.findUniqueOrThrow({ where: { id } });
    const ttl = tokenTtlForCategory(doc.category);
    const token = this.storage.createAccessToken(doc.storageKey, ttl);
    return { downloadPath: `/api/v1/uploads/download?token=${token}`, expiresInSeconds: ttl };
  }
}
