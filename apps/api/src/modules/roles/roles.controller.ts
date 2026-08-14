import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { RoleKind } from '@maher/database';
import { RequireAnyPermissions, RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@maher/types';
import { RolesService } from './roles.service';

class CreateRoleDto {
  @IsString() @MinLength(2) code!: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsString() @MinLength(1) nameEn!: string;
  @IsOptional() @IsString() nameHe?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) permissionCodes?: string[];
}

class UpdateRoleDto {
  @IsOptional() @IsString() @MinLength(1) nameAr?: string;
  @IsOptional() @IsString() @MinLength(1) nameEn?: string;
  @IsOptional() @IsString() nameHe?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) permissionCodes?: string[];
}

class ListRolesQueryDto {
  @IsOptional()
  @IsIn(['CUSTOMER', 'PRODUCTION_WORKER', 'STAFF', 'ADMIN'])
  kind?: RoleKind;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequireAnyPermissions('role.manage', 'user.manage')
  list(@Query() query: ListRolesQueryDto) {
    return this.roles.listRoles(query);
  }

  @Get('permissions')
  @RequireAnyPermissions('role.manage', 'user.manage')
  listPermissions() {
    return this.roles.permissionCatalog(false);
  }

  @Get('permission-catalog')
  @RequireAnyPermissions('role.manage', 'user.manage')
  permissionCatalog(@Query('staff') staff?: string) {
    return this.roles.permissionCatalog(staff === 'true');
  }

  @Get(':id')
  @RequireAnyPermissions('role.manage', 'user.manage')
  get(@Param('id') id: string) {
    return this.roles.getRole(id);
  }

  @Post()
  @RequirePermissions('role.manage')
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthUser) {
    return this.roles.createGenericRole(actor, dto);
  }

  @Post(':id/duplicate')
  @RequirePermissions('role.manage')
  duplicate(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.roles.duplicateGenericRole(actor, id);
  }

  @Patch(':id')
  @RequirePermissions('role.manage')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto, @CurrentUser() actor: AuthUser) {
    return this.roles.updateGenericRole(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('role.manage')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.roles.removeRole(actor, id);
  }
}
