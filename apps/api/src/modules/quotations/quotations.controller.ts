import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@maher/types';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AcceptQuotationDto,
  CreateQuotationDto,
  ListQuotationsDto,
  RejectQuotationDto,
  RequestRevisionDto,
  UpdateQuotationDto,
} from './dto/quotation.dto';
import { QuotationsService } from './quotations.service';

@ApiTags('quotations')
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @RequirePermissions('quotation.read')
  @Get()
  list(@Query() query: ListQuotationsDto, @CurrentUser() user: AuthUser) {
    return this.quotations.list(query, user);
  }

  @RequirePermissions('quotation.create')
  @Post()
  create(@Body() dto: CreateQuotationDto, @CurrentUser() user: AuthUser) {
    return this.quotations.create(dto, user.id);
  }

  @RequirePermissions('quotation.read')
  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.quotations.getById(id, user);
  }

  @RequirePermissions('quotation.update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quotations.updateDraft(id, dto, user);
  }

  @RequirePermissions('quotation.update')
  @Post(':id/submit-for-approval')
  submitForApproval(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.quotations.submitForApproval(id, user);
  }

  @RequirePermissions('quotation.approve')
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: RejectQuotationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quotations.approve(id, user, dto.comment);
  }

  @RequirePermissions('quotation.send')
  @Post(':id/send')
  send(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.quotations.send(id, user);
  }

  @RequirePermissions('quotation.accept')
  @Post(':id/accept')
  accept(
    @Param('id') id: string,
    @Body() dto: AcceptQuotationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quotations.accept(id, user, dto.signatureData);
  }

  @RequirePermissions('quotation.reject')
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectQuotationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quotations.reject(id, user, dto.comment);
  }

  @RequirePermissions('quotation.accept')
  @Post(':id/request-revision')
  requestRevision(
    @Param('id') id: string,
    @Body() dto: RequestRevisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quotations.requestRevision(id, user, dto.comment);
  }

  @RequirePermissions('quotation.update')
  @Post(':id/revise')
  revise(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.quotations.revise(id, user);
  }

  @RequirePermissions('quotation.read')
  @Get(':id/versions')
  versions(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.quotations.compareVersions(id, user);
  }
}
