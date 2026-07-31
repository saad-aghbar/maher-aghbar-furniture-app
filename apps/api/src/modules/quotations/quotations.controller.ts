import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@maher/types';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateQuotationDto, ListQuotationsDto, RejectQuotationDto } from './dto/quotation.dto';
import { QuotationsService } from './quotations.service';

@ApiTags('quotations')
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @RequirePermissions('quotation.read')
  @Get()
  list(@Query() query: ListQuotationsDto) {
    return this.quotations.list(query);
  }

  @RequirePermissions('quotation.create')
  @Post()
  create(@Body() dto: CreateQuotationDto, @CurrentUser() user: AuthUser) {
    return this.quotations.create(dto, user.id);
  }

  @RequirePermissions('quotation.read')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.quotations.getById(id);
  }

  @RequirePermissions('quotation.update')
  @Post(':id/submit-for-approval')
  submitForApproval(@Param('id') id: string) {
    return this.quotations.submitForApproval(id);
  }

  @RequirePermissions('quotation.approve')
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: RejectQuotationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quotations.approve(id, user.id, dto.comment);
  }

  @RequirePermissions('quotation.send')
  @Post(':id/send')
  send(@Param('id') id: string) {
    return this.quotations.send(id);
  }

  @RequirePermissions('quotation.accept')
  @Post(':id/accept')
  accept(@Param('id') id: string) {
    return this.quotations.accept(id);
  }

  @RequirePermissions('quotation.reject')
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectQuotationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quotations.reject(id, user.id, dto.comment);
  }

  @RequirePermissions('quotation.update')
  @Post(':id/revise')
  revise(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.quotations.revise(id, user.id);
  }

  @RequirePermissions('quotation.read')
  @Get(':id/versions')
  versions(@Param('id') id: string) {
    return this.quotations.compareVersions(id);
  }
}
