import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@maher/types';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateRequestDto, ListRequestsDto, UpdateRequestDto } from './dto/request.dto';
import { RequestsService } from './requests.service';

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @RequirePermissions('request.read')
  @Get()
  list(@Query() query: ListRequestsDto, @CurrentUser() user: AuthUser) {
    return this.requests.list(query, user);
  }

  @RequirePermissions('request.create')
  @Post()
  create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: AuthUser,
    @Query('submit') submit?: string,
  ) {
    const autoSubmit = submit === 'true' || submit === '1' || Boolean(user.customerId);
    return this.requests.create(dto, user.id, { submit: autoSubmit, user });
  }

  @RequirePermissions('request.read')
  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.requests.getById(id, user);
  }

  @RequirePermissions('request.update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requests.update(id, dto, user);
  }

  @RequirePermissions('request.update')
  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.requests.submit(id, user);
  }

  @RequirePermissions('request.update')
  @Post(':id/under-review')
  underReview(@Param('id') id: string) {
    return this.requests.markUnderReview(id);
  }

  @RequirePermissions('request.update')
  @Post(':id/ready-for-quotation')
  readyForQuotation(@Param('id') id: string) {
    return this.requests.markReadyForQuotation(id);
  }

  @RequirePermissions('request.update')
  @Post(':id/needs-information')
  needsInformation(
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.requests.markNeedsInformation(id, body.notes);
  }

  @RequirePermissions('request.update')
  @Post(':id/close')
  close(@Param('id') id: string) {
    return this.requests.close(id);
  }
}
