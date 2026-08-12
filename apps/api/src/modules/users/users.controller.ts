import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  BadRequestException,
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
import { Transform } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Locale, Prisma } from '@maher/database';
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

function splitCodes(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const codes = raw.map((v) => String(v).trim()).filter(Boolean);
  return codes.length ? codes : undefined;
}

class ListUsersDto extends PaginationDto {
  @IsOptional()
  @IsString()
  isActive?: string;

  @IsOptional()
  @IsString()
  roleCode?: string;

  /** Comma-separated role codes (OR match). Ignored when roleCode is set. */
  @IsOptional()
  @Transform(({ value }) => splitCodes(value))
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];

  @IsOptional()
  @IsString()
  departmentCode?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

class CreateUserDto {
  @IsString()
  @MinLength(2)
  username!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

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
  @MinLength(1)
  password?: string;

  @IsOptional()
  @IsEnum(Locale)
  preferredLanguage?: Locale;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  stageDefinitionIds?: string[];
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  username?: string;

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
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  stageDefinitionIds?: string[];

  /** Optional new password set by admin. Leave unset to keep current. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;
}

const userSelect = {
  id: true,
  username: true,
  departmentId: true,
  department: {
    select: { id: true, code: true, nameAr: true, nameEn: true },
  },
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
  workerSkills: {
    where: { isActive: true },
    select: { stageDefinitionId: true },
  },
} as const;

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  private async syncWorkerSkills(userId: string, stageDefinitionIds: string[] | undefined) {
    if (stageDefinitionIds === undefined) return;
    const desired = new Set(stageDefinitionIds);
    const existing = await this.prisma.workerSkill.findMany({ where: { userId } });
    for (const skill of existing) {
      if (!desired.has(skill.stageDefinitionId)) {
        if (skill.isActive) {
          await this.prisma.workerSkill.update({
            where: { id: skill.id },
            data: { isActive: false },
          });
        }
      } else if (!skill.isActive) {
        await this.prisma.workerSkill.update({
          where: { id: skill.id },
          data: { isActive: true },
        });
      }
      desired.delete(skill.stageDefinitionId);
    }
    for (const stageDefinitionId of desired) {
      await this.prisma.workerSkill.create({
        data: { userId, stageDefinitionId, isActive: true },
      });
    }
  }

  private withStageIds<T extends { workerSkills?: Array<{ stageDefinitionId: string }> }>(
    user: T,
  ) {
    const { workerSkills, ...rest } = user;
    return {
      ...rest,
      stageDefinitionIds: (workerSkills ?? []).map((s) => s.stageDefinitionId),
    };
  }

  /** Worker and Admin accounts do not use department; ignore client-supplied departmentId. */
  private async resolveDepartmentIdForRoles(
    roleIds: string[] | undefined,
    departmentId: string | null | undefined,
    fallbackRoleCodes?: string[],
  ): Promise<string | null | undefined> {
    if (departmentId === undefined) return undefined;

    let codes = fallbackRoleCodes;
    if (roleIds?.length) {
      const roles = await this.prisma.role.findMany({
        where: { id: { in: roleIds } },
        select: { code: true },
      });
      codes = roles.map((r) => r.code);
    }

    const noDepartment = (codes ?? []).some(
      (code) => code === 'PRODUCTION_WORKER' || code === 'SYSTEM_ADMINISTRATOR',
    );
    if (noDepartment) {
      // Leave existing DB value unchanged on update (caller should pass undefined).
      // On create, omit department entirely.
      return undefined;
    }
    return departmentId === null || departmentId === '' ? null : departmentId;
  }

  @Get('users')
  @RequirePermissions('user.manage')
  async listUsers(@Query() query: ListUsersDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const roleFilter = query.roleCode
      ? { roles: { some: { role: { code: query.roleCode } } } }
      : query.roleCodes?.length
        ? { roles: { some: { role: { code: { in: query.roleCodes } } } } }
        : {};
    const where: Prisma.UserWhereInput = {
      archivedAt: null,
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { username: { contains: query.q, mode: 'insensitive' } },
              { firstName: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.isActive === 'true' ? { isActive: true } : {}),
      ...(query.isActive === 'false' ? { isActive: false } : {}),
      ...roleFilter,
      ...(query.departmentCode
        ? { department: { code: query.departmentCode } }
        : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
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
    return { data: data.map((u) => this.withStageIds(u)), meta: paginatedMeta(page, pageSize, totalItems) };
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
    return { ...this.withStageIds(user), effectivePermissions: permissions };
  }

  @Post('users')
  @RequirePermissions('user.manage')
  async createUser(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    const username = dto.username.trim().toLowerCase();
    const email = dto.email?.trim() ? dto.email.toLowerCase() : undefined;
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new ConflictException({
        code: 'USERNAME_IN_USE',
        message: 'A user with this username already exists.',
      });
    }

    const tempPassword =
      dto.password ?? `Tmp-${randomBytes(6).toString('base64url')}!A1`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const departmentId = await this.resolveDepartmentIdForRoles(
      dto.roleIds,
      dto.departmentId ?? null,
    );

    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        preferredLanguage: dto.preferredLanguage ?? 'ar',
        customerId: dto.customerId,
        ...(departmentId ? { departmentId } : {}),
        passwordHash,
        isActive: dto.isActive ?? true,
        roles: dto.roleIds?.length
          ? { create: dto.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      select: userSelect,
    });

    await this.syncWorkerSkills(user.id, dto.stageDefinitionIds);

    await this.prisma.auditEvent.create({
      data: {
        userId: actor.id,
        action: 'user.create',
        entityType: 'User',
        entityId: user.id,
        newValues: {
          username,
          email,
          roleIds: dto.roleIds ?? [],
          stageDefinitionIds: dto.stageDefinitionIds ?? [],
          isActive: user.isActive,
        },
      },
    });

    return {
      ...this.withStageIds(user),
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

    let nextUsername: string | undefined;
    if (dto.username !== undefined) {
      nextUsername = dto.username.trim().toLowerCase();
      if (nextUsername.length < 2) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Username must be at least 2 characters.',
        });
      }
      if (nextUsername !== existing.username) {
        const clash = await this.prisma.user.findUnique({ where: { username: nextUsername } });
        if (clash) {
          throw new ConflictException({
            code: 'USERNAME_IN_USE',
            message: 'A user with this username already exists.',
          });
        }
      }
    }

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

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    const existingRoleCodes = existing.roles.map((r) => r.role.code);
    const departmentId = await this.resolveDepartmentIdForRoles(
      dto.roleIds,
      dto.departmentId,
      existingRoleCodes,
    );

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(nextUsername !== undefined ? { username: nextUsername } : {}),
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        preferredLanguage: dto.preferredLanguage,
        customerId: dto.customerId === undefined ? undefined : dto.customerId,
        ...(departmentId === undefined
          ? {}
          : { departmentId }),
        isActive: dto.isActive,
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: userSelect,
    });

    if (passwordHash) {
      await this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.syncWorkerSkills(id, dto.stageDefinitionIds);

    await this.prisma.auditEvent.create({
      data: {
        userId: actor.id,
        action: 'user.update',
        entityType: 'User',
        entityId: id,
        oldValues: {
          username: existing.username,
          firstName: existing.firstName,
          lastName: existing.lastName,
          email: existing.email,
          isActive: existing.isActive,
          departmentId: existing.departmentId,
        },
        newValues: {
          ...dto,
          ...(dto.password ? { password: '[changed]' } : {}),
        },
      },
    });

    return this.withStageIds(user);
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
