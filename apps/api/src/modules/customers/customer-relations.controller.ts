import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { CommunicationType, Locale } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@maher/types';

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

@ApiTags('customers')
@Controller('customers/:customerId')
export class CustomerRelationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('contacts')
  @RequirePermissions('customer.read')
  listContacts(@Param('customerId') customerId: string) {
    return this.prisma.customerContact.findMany({
      where: { customerId, archivedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    });
  }

  @Post('contacts')
  @RequirePermissions('contact.manage')
  createContact(@Param('customerId') customerId: string, @Body() dto: ContactDto) {
    return this.prisma.customerContact.create({
      data: { customerId, ...dto },
    });
  }

  @Patch('contacts/:id')
  @RequirePermissions('contact.manage')
  updateContact(@Param('id') id: string, @Body() dto: ContactDto) {
    return this.prisma.customerContact.update({ where: { id }, data: dto });
  }

  @Delete('contacts/:id')
  @RequirePermissions('contact.manage')
  archiveContact(@Param('id') id: string) {
    return this.prisma.customerContact.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  @Get('addresses')
  @RequirePermissions('customer.read')
  listAddresses(@Param('customerId') customerId: string) {
    return this.prisma.customerAddress.findMany({
      where: { customerId, archivedAt: null },
    });
  }

  @Post('addresses')
  @RequirePermissions('address.manage')
  createAddress(@Param('customerId') customerId: string, @Body() dto: AddressDto) {
    return this.prisma.customerAddress.create({
      data: { customerId, country: dto.country ?? 'JO', ...dto },
    });
  }

  @Patch('addresses/:id')
  @RequirePermissions('address.manage')
  updateAddress(@Param('id') id: string, @Body() dto: AddressDto) {
    return this.prisma.customerAddress.update({ where: { id }, data: dto });
  }

  @Delete('addresses/:id')
  @RequirePermissions('address.manage')
  archiveAddress(@Param('id') id: string) {
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
}
