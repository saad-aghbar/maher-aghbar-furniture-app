import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Locale } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import type { AuthUser } from '@maher/types';
import {
  assertCannotDeactivateSelf,
  assertCannotRemoveOwnAdmin,
  assertNotLastActiveAdmin,
} from './users.guards';

class ListUsersDto extends PaginationDto {
  @IsOptional()
  @IsString()
  isActive?: string;

  @IsOptional()
  @IsString()
  roleCode?: string;
}

class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsEnum(Locale)
  preferredLanguage?: Locale;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(Locale)
  preferredLanguage?: Locale;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  customerId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}

const userSelect = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  preferredLanguage: true,
  isActive: true,
  mfaEnabled: true,
  lastLoginAt: true,
  customerId: true,
  createdAt: true,
  roles: { include: { role: true } },
} as const;

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users')
  @RequirePermissions('user.manage')
  async listUsers(@Query() query: ListUsersDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where = {
      archivedAt: null,
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' as const } },
              { firstName: { contains: query.q, mode: 'insensitive' as const } },
              { lastName: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.isActive === 'true' ? { isActive: true } : {}),
      ...(query.isActive === 'false' ? { isActive: false } : {}),
      ...(query.roleCode
        ? { roles: { some: { role: { code: query.roleCode } } } }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  @Get('users/:id')
  @RequirePermissions('user.manage')
  async getUser(@Param('id') id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, archivedAt: null },
      select: {
        ...userSelect,
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found.' });
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)),
      ),
    ];
    return { ...user, effectivePermissions: permissions };
  }

  @Post('users')
  @RequirePermissions('user.manage')
  async createUser(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_IN_USE',
        message: 'A user with this email already exists.',
      });
    }

    const tempPassword =
      dto.password ?? `Tmp-${randomBytes(6).toString('base64url')}!A1`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        preferredLanguage: dto.preferredLanguage ?? 'ar',
        customerId: dto.customerId,
        passwordHash,
        isActive: dto.isActive ?? true,
        roles: dto.roleIds?.length
          ? { create: dto.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      select: userSelect,
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: actor.id,
        action: 'user.create',
        entityType: 'User',
        entityId: user.id,
        newValues: { email, roleIds: dto.roleIds ?? [], isActive: user.isActive },
      },
    });

    return {
      ...user,
      temporaryPassword: dto.password ? undefined : tempPassword,
    };
  }

  @Patch('users/:id')
  @RequirePermissions('user.manage')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id, archivedAt: null },
      include: { roles: { include: { role: true } } },
    });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found.' });

    if (dto.email && dto.email.toLowerCase() !== existing.email) {
      const clash = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
      if (clash) {
        throw new ConflictException({
          code: 'EMAIL_IN_USE',
          message: 'A user with this email already exists.',
        });
      }
    }

    if (dto.isActive === false) {
      assertCannotDeactivateSelf(actor.id, id);
      await this.ensureNotLastActiveAdmin(id);
    }

    if (dto.roleIds) {
      if (id === actor.id) {
        const roles = await this.prisma.role.findMany({
          where: { id: { in: dto.roleIds } },
        });
        const stillAdmin = roles.some((r) => r.code === 'SYSTEM_ADMINISTRATOR');
        const wasAdmin = existing.roles.some((r) => r.role.code === 'SYSTEM_ADMINISTRATOR');
        assertCannotRemoveOwnAdmin(actor.id, id, wasAdmin, stillAdmin);
      }
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      if (dto.roleIds.length) {
        await this.prisma.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        preferredLanguage: dto.preferredLanguage,
        customerId: dto.customerId === undefined ? undefined : dto.customerId,
        isActive: dto.isActive,
      },
      select: userSelect,
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: actor.id,
        action: 'user.update',
        entityType: 'User',
        entityId: id,
        oldValues: {
          firstName: existing.firstName,
          lastName: existing.lastName,
          email: existing.email,
          isActive: existing.isActive,
        },
        newValues: dto as object,
      },
    });

    return user;
  }

  @Post('users/:id/activate')
  @RequirePermissions('user.manage')
  activate(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.updateUser(id, { isActive: true }, actor);
  }

  @Post('users/:id/deactivate')
  @RequirePermissions('user.manage')
  deactivate(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.updateUser(id, { isActive: false }, actor);
  }

  @Post('users/:id/reset-password')
  @RequirePermissions('user.manage')
  async resetPassword(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    const user = await this.prisma.user.findFirst({ where: { id, archivedAt: null } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found.' });
    const temporaryPassword = `Reset-${randomBytes(6).toString('base64url')}!A1`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.prisma.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: actor.id,
        action: 'user.reset_password',
        entityType: 'User',
        entityId: id,
      },
    });
    return { ok: true, temporaryPassword };
  }

  private async ensureNotLastActiveAdmin(userId: string) {
    const adminRole = await this.prisma.role.findUnique({
      where: { code: 'SYSTEM_ADMINISTRATOR' },
    });
    if (!adminRole) return;
    const isAdmin = await this.prisma.userRole.findFirst({
      where: { userId, roleId: adminRole.id },
    });
    if (!isAdmin) return;
    const otherAdmins = await this.prisma.userRole.count({
      where: {
        roleId: adminRole.id,
        userId: { not: userId },
        user: { isActive: true, archivedAt: null },
      },
    });
    assertNotLastActiveAdmin(otherAdmins);
  }
}
