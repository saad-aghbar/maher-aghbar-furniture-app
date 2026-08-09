import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { AiIntakeService } from './ai-intake.service';
import { RequireAnyPermissions, RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthUser } from '@maher/types';

class CreateAiJobDto {
  @IsString()
  sourceType!: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  @IsString()
  rawText?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;
}

class ApproveAiJobDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsObject()
  fieldOverrides?: Record<string, string>;
}

class RejectAiJobDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class FromUploadDto {
  @IsString()
  storageKey!: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  mimeHint?: string;
}

class ExtractPreviewDto {
  @IsString()
  storageKey!: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  mimeHint?: string;
}

class CorrectAiJobDto {
  @IsObject()
  fieldOverrides!: Record<string, string>;
}

class ManualAiJobDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

class LinkJobDto {
  @IsUUID()
  requestId!: string;
}

@ApiTags('ai-intake')
@Controller('ai-intake')
export class AiIntakeController {
  constructor(private readonly ai: AiIntakeService) {}

  @Get('jobs')
  @RequirePermissions('ai-intake.read')
  list(@Query() query: PaginationDto) {
    return this.ai.list(query);
  }

  @Post('jobs')
  @RequirePermissions('ai-intake.manage')
  create(@Body() dto: CreateAiJobDto, @CurrentUser() user: AuthUser) {
    return this.ai.createJob(dto, user.id);
  }

  @Post('from-upload')
  @RequireAnyPermissions('ai-intake.manage', 'request.create')
  fromUpload(@Body() dto: FromUploadDto, @CurrentUser() user: AuthUser) {
    const customerId = user.customerId ?? dto.customerId;
    if (!customerId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'customerId is required.',
      });
    }
    if (user.customerId && dto.customerId && dto.customerId !== user.customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot create orders for another customer.',
      });
    }
    return this.ai.processUploadIntoDraftOrder({
      storageKey: dto.storageKey,
      customerId,
      userId: user.id,
      mimeHint: dto.mimeHint,
      sourceType: dto.sourceType ?? 'IMAGE',
      dealerOriginated: Boolean(user.customerId),
    });
  }

  @Post('extract-preview')
  @RequireAnyPermissions('ai-intake.manage', 'request.create')
  extractPreview(@Body() dto: ExtractPreviewDto, @CurrentUser() user: AuthUser) {
    if (user.customerId && dto.customerId && dto.customerId !== user.customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot extract for another customer.',
      });
    }
    return this.ai.extractPreview({
      storageKey: dto.storageKey,
      customerId: user.customerId ?? dto.customerId,
      userId: user.id,
      mimeHint: dto.mimeHint,
      sourceType: dto.sourceType ?? 'IMAGE',
    });
  }

  @Post('jobs/:id/link-request')
  @RequireAnyPermissions('ai-intake.manage', 'request.create')
  linkRequest(
    @Param('id') id: string,
    @Body() dto: LinkJobDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ai.linkJobToRequest(id, dto.requestId, user.id);
  }

  @Get('jobs/:id')
  @RequirePermissions('ai-intake.read')
  get(@Param('id') id: string) {
    return this.ai.get(id);
  }

  @Post('jobs/:id/correct')
  @RequirePermissions('ai-intake.manage')
  correct(
    @Param('id') id: string,
    @Body() dto: CorrectAiJobDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ai.correctFields(id, dto.fieldOverrides ?? {}, user.id);
  }

  @Post('jobs/:id/manual')
  @RequirePermissions('ai-intake.manage')
  manual(
    @Param('id') id: string,
    @Body() dto: ManualAiJobDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ai.requestManualHandling(id, user.id, dto.notes);
  }

  @Post('jobs/:id/approve')
  @RequirePermissions('ai-intake.manage')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveAiJobDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ai.approve(id, dto, user.id);
  }

  @Post('jobs/:id/reject')
  @RequirePermissions('ai-intake.manage')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectAiJobDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ai.reject(id, user.id, dto.reason);
  }
}
