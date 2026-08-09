import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CommunicationType, Locale, Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@maher/types';
import { assertCustomerOwns } from '../../common/helpers/customer-scope';

class ContactDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsEnum(Locale)
  preferredLanguage?: Locale;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

class AddressDto {
  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  recipient?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  building?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  additionalInstructions?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  isDefaultBilling?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefaultDelivery?: boolean;
}

class CommunicationDto {
  @IsEnum(CommunicationType)
  type!: CommunicationType;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  summary!: string;

  @IsOptional()
  @IsString()
  nextFollowUpAt?: string;
}

class UpdateCommunicationDto {
  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  nextFollowUpAt?: string;
}

class DealerPriceDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  price!: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

class UpdateDealerPriceDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

@ApiTags('customers')
@Controller('customers/:customerId')
export class CustomerRelationsController {
  constructor(private readonly prisma: PrismaService) {}

  private assertCustomerAccess(user: AuthUser, customerId: string) {
    if (!assertCustomerOwns(user, customerId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You can only access your own customer record.',
      });
    }
  }

  @Get('contacts')
  @RequirePermissions('customer.read')
  listContacts(@Param('customerId') customerId: string, @CurrentUser() user: AuthUser) {
    this.assertCustomerAccess(user, customerId);
    return this.prisma.customerContact.findMany({
      where: { customerId, archivedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    });
  }

  @Post('contacts')
  @RequirePermissions('contact.manage')
  createContact(
    @Param('customerId') customerId: string,
    @Body() dto: ContactDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCustomerAccess(user, customerId);
    return this.prisma.customerContact.create({
      data: { customerId, ...dto },
    });
  }

  @Patch('contacts/:id')
  @RequirePermissions('contact.manage')
  async updateContact(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @Body() dto: ContactDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCustomerAccess(user, customerId);
    const row = await this.prisma.customerContact.findFirst({ where: { id, customerId } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Contact not found.' });
    return this.prisma.customerContact.update({ where: { id }, data: dto });
  }

  @Delete('contacts/:id')
  @RequirePermissions('contact.manage')
  async archiveContact(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCustomerAccess(user, customerId);
    const row = await this.prisma.customerContact.findFirst({ where: { id, customerId } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Contact not found.' });
    return this.prisma.customerContact.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  @Get('addresses')
  @RequirePermissions('customer.read')
  listAddresses(@Param('customerId') customerId: string, @CurrentUser() user: AuthUser) {
    this.assertCustomerAccess(user, customerId);
    return this.prisma.customerAddress.findMany({
      where: { customerId, archivedAt: null },
      orderBy: [{ isDefaultDelivery: 'desc' }, { label: 'asc' }],
    });
  }

  @Post('addresses')
  @RequirePermissions('address.manage')
  async createAddress(
    @Param('customerId') customerId: string,
    @Body() dto: AddressDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCustomerAccess(user, customerId);
    const { latitude, longitude, isDefaultDelivery, isDefaultBilling, ...rest } = dto;
    const wantDelivery = Boolean(isDefaultDelivery);
    const wantBilling = Boolean(isDefaultBilling);

    return this.prisma.$transaction(async (tx) => {
      await this.assertAddressDefaultsAvailable(tx, customerId, null, {
        wantDelivery,
        wantBilling,
      });
      // Defense: clear any stale duplicate defaults before insert.
      if (wantDelivery) {
        await tx.customerAddress.updateMany({
          where: { customerId, archivedAt: null, isDefaultDelivery: true },
          data: { isDefaultDelivery: false },
        });
      }
      if (wantBilling) {
        await tx.customerAddress.updateMany({
          where: { customerId, archivedAt: null, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        });
      }
      return tx.customerAddress.create({
        data: {
          customerId,
          country: dto.country ?? 'JO',
          ...rest,
          isDefaultDelivery: wantDelivery,
          isDefaultBilling: wantBilling,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
        },
      });
    });
  }

  @Patch('addresses/:id')
  @RequirePermissions('address.manage')
  async updateAddress(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @Body() dto: AddressDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCustomerAccess(user, customerId);
    const row = await this.prisma.customerAddress.findFirst({ where: { id, customerId } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Address not found.' });
    const { latitude, longitude, isDefaultDelivery, isDefaultBilling, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      const nextDelivery =
        isDefaultDelivery !== undefined ? Boolean(isDefaultDelivery) : row.isDefaultDelivery;
      const nextBilling =
        isDefaultBilling !== undefined ? Boolean(isDefaultBilling) : row.isDefaultBilling;

      // Claiming a new default (this row did not have it) requires availability.
      await this.assertAddressDefaultsAvailable(tx, customerId, id, {
        wantDelivery: nextDelivery && !row.isDefaultDelivery,
        wantBilling: nextBilling && !row.isDefaultBilling,
      });

      // Keep / set default: clear duplicates on other rows.
      if (nextDelivery) {
        await tx.customerAddress.updateMany({
          where: {
            customerId,
            archivedAt: null,
            isDefaultDelivery: true,
            id: { not: id },
          },
          data: { isDefaultDelivery: false },
        });
      }
      if (nextBilling) {
        await tx.customerAddress.updateMany({
          where: {
            customerId,
            archivedAt: null,
            isDefaultBilling: true,
            id: { not: id },
          },
          data: { isDefaultBilling: false },
        });
      }

      return tx.customerAddress.update({
        where: { id },
        data: {
          ...rest,
          ...(isDefaultDelivery !== undefined ? { isDefaultDelivery: nextDelivery } : {}),
          ...(isDefaultBilling !== undefined ? { isDefaultBilling: nextBilling } : {}),
          ...(latitude !== undefined ? { latitude } : {}),
          ...(longitude !== undefined ? { longitude } : {}),
        },
      });
    });
  }

  /**
   * At most one default delivery and one default billing per customer.
   * Rejects if another address already holds the requested flag.
   */
  private async assertAddressDefaultsAvailable(
    tx: Prisma.TransactionClient,
    customerId: string,
    exceptId: string | null,
    opts: { wantDelivery: boolean; wantBilling: boolean },
  ) {
    if (opts.wantDelivery) {
      const other = await tx.customerAddress.findFirst({
        where: {
          customerId,
          archivedAt: null,
          isDefaultDelivery: true,
          ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        select: { id: true, label: true },
      });
      if (other) {
        throw new ConflictException({
          code: 'DEFAULT_DELIVERY_TAKEN',
          message: 'Another address is already the default for delivery.',
        });
      }
    }
    if (opts.wantBilling) {
      const other = await tx.customerAddress.findFirst({
        where: {
          customerId,
          archivedAt: null,
          isDefaultBilling: true,
          ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        select: { id: true, label: true },
      });
      if (other) {
        throw new ConflictException({
          code: 'DEFAULT_BILLING_TAKEN',
          message: 'Another address is already the default for billing.',
        });
      }
    }
  }

  @Delete('addresses/:id')
  @RequirePermissions('address.manage')
  async archiveAddress(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCustomerAccess(user, customerId);
    const row = await this.prisma.customerAddress.findFirst({ where: { id, customerId } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Address not found.' });
    return this.prisma.customerAddress.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  @Get('communications')
  @RequirePermissions('customer.read')
  listComms(@Param('customerId') customerId: string) {
    return this.prisma.communicationLog.findMany({
      where: { customerId },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { occurredAt: 'desc' },
    });
  }

  @Post('communications')
  @RequirePermissions('customer.update')
  createComm(
    @Param('customerId') customerId: string,
    @Body() dto: CommunicationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prisma.communicationLog.create({
      data: {
        customerId,
        type: dto.type,
        contactName: dto.contactName,
        subject: dto.subject,
        summary: dto.summary,
        employeeId: user.id,
        nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : undefined,
      },
    });
  }

  @Patch('communications/:id')
  @RequirePermissions('customer.update')
  async updateComm(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCommunicationDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCustomerAccess(user, customerId);
    const row = await this.prisma.communicationLog.findFirst({
      where: { id, customerId },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Note not found.' });
    }
    const summary = dto.summary !== undefined ? dto.summary.trim() : undefined;
    if (summary !== undefined && !summary) {
      throw new BadRequestException({
        code: 'SUMMARY_REQUIRED',
        message: 'Note summary is required.',
      });
    }
    return this.prisma.communicationLog.update({
      where: { id },
      data: {
        ...(dto.contactName !== undefined ? { contactName: dto.contactName } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(summary !== undefined ? { summary } : {}),
        ...(dto.nextFollowUpAt !== undefined
          ? { nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null }
          : {}),
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  @Get('activity')
  @RequirePermissions('customer.read')
  activity(@Param('customerId') customerId: string) {
    return this.prisma.auditEvent.findMany({
      where: {
        OR: [
          { entityType: 'Customer', entityId: customerId },
          { entityType: 'Quotation', newValues: { path: ['customerId'], equals: customerId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get('dealer-prices')
  @RequirePermissions('customer.read')
  listDealerPrices(@Param('customerId') customerId: string) {
    return this.prisma.dealerPrice.findMany({
      where: { customerId },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            nameEn: true,
            nameAr: true,
            nameHe: true,
            basePrice: true,
            manufacturingCost: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post('dealer-prices')
  @RequirePermissions('customer.update')
  async createDealerPrice(
    @Param('customerId') customerId: string,
    @Body() dto: DealerPriceDto,
    @CurrentUser() user: AuthUser,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, archivedAt: null },
    });
    if (!product) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });
    }
    const row = await this.prisma.dealerPrice.upsert({
      where: { customerId_productId: { customerId, productId: dto.productId } },
      create: {
        customerId,
        productId: dto.productId,
        price: dto.price,
        currency: dto.currency ?? 'JOD',
      },
      update: {
        price: dto.price,
        currency: dto.currency ?? 'JOD',
      },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            nameEn: true,
            nameAr: true,
            nameHe: true,
            basePrice: true,
            manufacturingCost: true,
            imageUrl: true,
          },
        },
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'dealer-price.upsert',
        entityType: 'DealerPrice',
        entityId: row.id,
        newValues: row,
      },
    });
    return row;
  }

  @Patch('dealer-prices/:id')
  @RequirePermissions('customer.update')
  async updateDealerPrice(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDealerPriceDto,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.dealerPrice.findFirst({ where: { id, customerId } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Dealer price not found.' });
    }
    const row = await this.prisma.dealerPrice.update({
      where: { id },
      data: {
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            nameEn: true,
            nameAr: true,
            nameHe: true,
            basePrice: true,
            manufacturingCost: true,
            imageUrl: true,
          },
        },
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'dealer-price.update',
        entityType: 'DealerPrice',
        entityId: id,
        newValues: row,
      },
    });
    return row;
  }

  @Delete('dealer-prices/:id')
  @RequirePermissions('customer.update')
  async deleteDealerPrice(
    @Param('customerId') customerId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.dealerPrice.findFirst({ where: { id, customerId } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Dealer price not found.' });
    }
    await this.prisma.dealerPrice.delete({ where: { id } });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'dealer-price.delete',
        entityType: 'DealerPrice',
        entityId: id,
        newValues: Prisma.JsonNull,
      },
    });
    return { ok: true };
  }
}
