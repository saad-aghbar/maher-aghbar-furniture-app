import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@maher/types';
import { FabricProcurementService } from './fabric-procurement.service';

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

@ApiTags('fabric-procurement')
@Controller('fabric-procurements')
export class FabricProcurementController {
  constructor(private readonly fabrics: FabricProcurementService) {}

  @Get()
  @RequirePermissions('fabric.procurement.read')
  list(
    @Query('q') q?: string,
    @Query('state') state?: string,
    @Query('salesOrderId') salesOrderId?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.fabrics.list({ q, state, salesOrderId }, user);
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

  @Get(':id')
  @RequirePermissions('fabric.procurement.read')
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
