import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { RequireAnyPermissions, RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@maher/types';

const PROTECTED_ROLES = new Set([
  'SYSTEM_ADMINISTRATOR',
  'CUSTOMER',
  'GENERAL_MANAGER',
]);

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

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequireAnyPermissions('role.manage', 'user.manage')
  list() {
    return this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  @Get('permissions')
  @RequirePermissions('role.manage')
  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }

  @Get(':id')
  @RequirePermissions('role.manage')
  async get(@Param('id') id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        users: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } } } },
      },
    });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found.' });
    return role;
  }

  @Post()
  @RequirePermissions('role.manage')
  async create(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthUser) {
    const code = dto.code.toUpperCase().replace(/\s+/g, '_');
    const clash = await this.prisma.role.findUnique({ where: { code } });
    if (clash) {
      throw new ConflictException({ code: 'ROLE_EXISTS', message: 'Role code already exists.' });
    }
    await this.assertCanGrant(actor, dto.permissionCodes ?? []);
    const role = await this.prisma.role.create({
      data: {
        code,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        nameHe: dto.nameHe,
        description: dto.description,
      },
    });
    if (dto.permissionCodes?.length) {
      await this.setPermissions(role.id, dto.permissionCodes);
    }
    await this.audit(actor.id, 'role.create', role.id, { code, permissionCodes: dto.permissionCodes });
    return this.get(role.id);
  }

  @Post(':id/duplicate')
  @RequirePermissions('role.manage')
  async duplicate(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    const src = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!src) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found.' });
    const code = `${src.code}_COPY_${Date.now().toString(36).toUpperCase()}`;
    const role = await this.prisma.role.create({
      data: {
        code,
        nameAr: `${src.nameAr} (نسخة)`,
        nameEn: `${src.nameEn} (copy)`,
        nameHe: src.nameHe,
        description: src.description,
      },
    });
    const codes = src.permissions.map((rp) => rp.permission.code);
    await this.setPermissions(role.id, codes);
    await this.audit(actor.id, 'role.duplicate', role.id, { from: id });
    return this.get(role.id);
  }

  @Patch(':id')
  @RequirePermissions('role.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found.' });
    if (dto.permissionCodes) await this.assertCanGrant(actor, dto.permissionCodes);
    await this.prisma.role.update({
      where: { id },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        nameHe: dto.nameHe,
        description: dto.description,
      },
    });
    if (dto.permissionCodes) {
      await this.setPermissions(id, dto.permissionCodes);
    }
    await this.audit(actor.id, 'role.update', id, dto as object);
    return this.get(id);
  }

  @Delete(':id')
  @RequirePermissions('role.manage')
  async remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found.' });
    if (PROTECTED_ROLES.has(role.code)) {
      throw new BadRequestException({
        code: 'PROTECTED_ROLE',
        message: 'System-critical roles cannot be deleted.',
      });
    }
    if (role._count.users > 0) {
      throw new ConflictException({
        code: 'ROLE_IN_USE',
        message: 'This role cannot be deleted because users are assigned to it.',
      });
    }
    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await this.prisma.role.delete({ where: { id } });
    await this.audit(actor.id, 'role.delete', id, { code: role.code });
    return { ok: true };
  }

  private async setPermissions(roleId: string, codes: string[]) {
    const perms = await this.prisma.permission.findMany({ where: { code: { in: codes } } });
    if (perms.length !== codes.length) {
      throw new BadRequestException({
        code: 'INVALID_PERMISSIONS',
        message: 'One or more permission codes are invalid.',
      });
    }
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    if (perms.length) {
      await this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId, permissionId: p.id })),
      });
    }
  }

  private assertCanGrant(actor: AuthUser, codes: string[]) {
    const missing = codes.filter((c) => !actor.permissions.includes(c as never));
    if (missing.length) {
      throw new BadRequestException({
        code: 'CANNOT_GRANT',
        message: `You cannot grant permissions you do not hold: ${missing.join(', ')}`,
      });
    }
  }

  private audit(userId: string, action: string, entityId: string, newValues: unknown) {
    return this.prisma.auditEvent.create({
      data: {
        userId,
        action,
        entityType: 'Role',
        entityId,
        newValues: (newValues ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
