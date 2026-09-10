import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { hasPermission } from '@maher/permissions';
import { RequireAnyPermissions, RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@maher/types';
import { FabricProcurementService } from './fabric-procurement.service';
import { FabricReceivingService } from './fabric-receiving.service';

class FabricSendDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @IsString()
  body?: string;
}

class FabricWaitDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  expectedAvailableAt?: string;
}

class FabricRedirectDto {
  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class FabricStateDto {
  @IsString()
  state!: 'SUPPLIER_CONFIRMED' | 'UNAVAILABLE' | 'PARTIALLY_AVAILABLE' | 'READY_FOR_PICKUP' | 'DELAYED';

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  expectedAvailableAt?: string;
}

class FabricOverrideDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

class FabricTakeInDto {
  @IsString()
  @MinLength(1)
  qrCode!: string;
}

class FabricDispositionDto {
  @IsString()
  @MinLength(1)
  qrCode!: string;

  @IsOptional()
  returnedQty?: number;

  @IsOptional()
  scrapQty?: number;

  @IsOptional()
  @IsString()
  scrapReason?: string;
}

class FabricReceiveDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsUUID()
  locationId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsUUID()
  photoDocumentId?: string;

  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

class FabricAllocateDto {
  @IsUUID()
  inventoryItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsBoolean()
  replaceFabric?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('fabric-procurement')
@Controller('fabric-procurements')
export class FabricProcurementController {
  constructor(
    private readonly fabrics: FabricProcurementService,
    private readonly receiving: FabricReceivingService,
  ) {}

  @Get()
  @RequirePermissions('fabric.procurement.read')
  list(
    @Query('q') q?: string,
    @Query('state') state?: string,
    @Query('salesOrderId') salesOrderId?: string,
    @Query('supplierId') supplierId?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.fabrics.list({ q, state, salesOrderId, supplierId }, user);
  }

  @Get('orders/:salesOrderId')
  @RequirePermissions('fabric.procurement.read')
  tracker(@Param('salesOrderId') salesOrderId: string, @CurrentUser() user?: AuthUser) {
    return this.fabrics.trackerForSalesOrder(salesOrderId, user);
  }

  @Get('tasks/:taskId/board')
  @RequirePermissions('production.material-usage.record')
  workerBoard(@Param('taskId') taskId: string) {
    return this.fabrics.workerBoard(taskId);
  }

  @Get('by-code/:code')
  @RequireAnyPermissions('fabric.procurement.read', 'inventory.read')
  getByCode(@Param('code') code: string, @CurrentUser() user?: AuthUser) {
    return this.fabrics.getByQrCode(code, user);
  }

  @Get(':id')
  @RequireAnyPermissions('fabric.procurement.read', 'inventory.read')
  get(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.fabrics.getById(id, user);
  }

  @Post('draft-whatsapp')
  @RequirePermissions('fabric.procurement.manage')
  draft(@Body() body: FabricSendDto) {
    return this.fabrics.draftWhatsApp(body.ids, body.supplierId);
  }

  @Post('send-whatsapp')
  @RequirePermissions('fabric.procurement.manage')
  send(@Body() body: FabricSendDto, @CurrentUser() user: AuthUser) {
    return this.fabrics.sendWhatsApp(body.ids, body.supplierId, user, body.body);
  }

  @Post(':id/wait')
  @RequirePermissions('fabric.procurement.manage')
  wait(@Param('id') id: string, @Body() body: FabricWaitDto, @CurrentUser() user: AuthUser) {
    return this.fabrics.wait(id, user, body.note, body.expectedAvailableAt);
  }

  @Post(':id/redirect')
  @RequirePermissions('fabric.procurement.manage')
  redirect(@Param('id') id: string, @Body() body: FabricRedirectDto, @CurrentUser() user: AuthUser) {
    return this.fabrics.redirect(id, user, body.supplierId, body.note);
  }

  @Post(':id/supplier-state')
  @RequirePermissions('fabric.procurement.manage')
  supplierState(
    @Param('id') id: string,
    @Body() body: FabricStateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.fabrics.setSupplierState(id, user, body);
  }

  @Post(':id/override')
  @RequirePermissions('production.fabric.override')
  override(
    @Param('id') id: string,
    @Body() body: FabricOverrideDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.fabrics.overrideHold(id, user, body.reason);
  }

  @Post(':id/receive')
  @RequirePermissions('inventory.receive')
  receive(
    @Param('id') id: string,
    @Body() body: FabricReceiveDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.receiving.receive(id, body, user);
  }

  @Post(':id/allocate-from-stock')
  @RequirePermissions('fabric.procurement.manage')
  allocateFromStock(
    @Param('id') id: string,
    @Body() body: FabricAllocateDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (body.replaceFabric && !hasPermission(user.permissions, 'production.fabric.override')) {
      throw new BadRequestException({
        code: 'FABRIC_REPLACE_FORBIDDEN',
        message: 'Replacing a fabric requires the fabric override permission.',
      });
    }
    return this.receiving.allocateFromStock(id, body, user);
  }

  @Post('tasks/:taskId/take-in')
  @RequirePermissions('production.material-usage.record')
  takeIn(
    @Param('taskId') taskId: string,
    @Body() body: FabricTakeInDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.fabrics.takeInLot({ taskId, qrCode: body.qrCode, user });
  }

  @Post('tasks/:taskId/disposition')
  @RequirePermissions('production.material-usage.record')
  disposition(
    @Param('taskId') taskId: string,
    @Body() body: FabricDispositionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.fabrics.recordDisposition({
      taskId,
      qrCode: body.qrCode,
      user,
      returnedQty: body.returnedQty,
      scrapQty: body.scrapQty,
      scrapReason: body.scrapReason,
    });
  }
}
