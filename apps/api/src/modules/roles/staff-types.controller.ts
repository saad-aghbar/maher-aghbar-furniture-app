import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { RequireAnyPermissions, RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@maher/types';
import { RolesService } from './roles.service';

class ListStaffTypesQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

class WriteStaffTypeDto {
  @IsString()
  @MinLength(1)
  nameEn!: string;

  @IsString()
  @MinLength(1)
  nameAr!: string;

  @IsOptional()
  @IsString()
  nameHe?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  descriptionHe?: string;

  @IsOptional()
  @IsString()
  iconKey?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];
}

@ApiTags('staff-types')
@Controller('staff-types')
export class StaffTypesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequireAnyPermissions('role.manage', 'user.manage')
  list(@Query() query: ListStaffTypesQueryDto) {
    return this.roles.listRoles({ kind: 'STAFF', isActive: query.isActive });
  }

  @Get(':id')
  @RequireAnyPermissions('role.manage', 'user.manage')
  get(@Param('id') id: string) {
    return this.roles.getRole(id);
  }

  @Post()
  @RequirePermissions('role.manage')
  create(@Body() dto: WriteStaffTypeDto, @CurrentUser() actor: AuthUser) {
    return this.roles.createStaffType(actor, dto);
  }

  @Patch(':id')
  @RequirePermissions('role.manage')
  update(@Param('id') id: string, @Body() dto: WriteStaffTypeDto, @CurrentUser() actor: AuthUser) {
    return this.roles.updateStaffType(actor, id, dto);
  }

  @Post(':id/duplicate')
  @RequirePermissions('role.manage')
  duplicate(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.roles.duplicateStaffType(actor, id);
  }

  @Post(':id/deactivate')
  @RequirePermissions('role.manage')
  deactivate(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.roles.deactivateStaffType(actor, id);
  }

  @Delete(':id')
  @RequirePermissions('role.manage')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.roles.removeStaffType(actor, id);
  }
}
