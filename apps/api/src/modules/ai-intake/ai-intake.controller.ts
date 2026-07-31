import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { AiIntakeService } from './ai-intake.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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

@ApiTags('ai-intake')
@Controller('ai-intake')
export class AiIntakeController {
  constructor(private readonly ai: AiIntakeService) {}

  @Post('jobs')
  @RequirePermissions('ai-intake.manage')
  create(@Body() dto: CreateAiJobDto, @CurrentUser() user: AuthUser) {
    return this.ai.createJob(dto, user.id);
  }

  @Get('jobs/:id')
  @RequirePermissions('ai-intake.read')
  get(@Param('id') id: string) {
    return this.ai.get(id);
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
}
