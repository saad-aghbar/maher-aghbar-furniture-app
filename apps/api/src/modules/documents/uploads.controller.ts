import {
  BadRequestException,
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
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { DocumentVisibility } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { Public, RequirePermissions } from '../../common/decorators/auth.decorators';
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

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly storage: LocalStorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @RequirePermissions('document.manage')
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
  ) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'File required.' });
    if (!ALLOWED.has(file.mimetype)) {
      throw new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'File type not allowed.' });
    }

    const stored = await this.storage.putObject(file.originalname, file.mimetype, file.buffer);
    const doc = await this.prisma.document.create({
      data: {
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.key,
        category: category ?? 'GENERAL',
        visibility:
          (visibility as DocumentVisibility | undefined) ?? DocumentVisibility.INTERNAL,
        uploadedById: user.id,
      },
    });

    const token = this.storage.createAccessToken(stored.key);
    return {
      document: doc,
      accessToken: token,
      downloadPath: `/api/v1/uploads/download?token=${token}`,
    };
  }

  @Public()
  @Get('download')
  async download(@Query('token') token: string, @Res() res: Response) {
    if (!token) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'token required' });
    const key = this.storage.verifyAccessToken(token);
    const stream = await this.storage.getObjectStream(key);
    res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);
    stream.pipe(res);
  }

  @Get('documents/:id/link')
  @RequirePermissions('document.read')
  async link(@Param('id') id: string) {
    const doc = await this.prisma.document.findUniqueOrThrow({ where: { id } });
    const token = this.storage.createAccessToken(doc.storageKey);
    return { downloadPath: `/api/v1/uploads/download?token=${token}`, expiresInSeconds: 900 };
  }
}
