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
  list(@Query() query: ListRequestsDto) {
    return this.requests.list(query);
  }

  @RequirePermissions('request.create')
  @Post()
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: AuthUser) {
    return this.requests.create(dto, user.id);
  }

  @RequirePermissions('request.read')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.requests.getById(id);
  }

  @RequirePermissions('request.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRequestDto) {
    return this.requests.update(id, dto);
  }

  @RequirePermissions('request.update')
  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.requests.submit(id);
  }
}
