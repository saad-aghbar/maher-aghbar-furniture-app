import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@maher/types';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, ListCustomersDto, UpdateCustomerDto } from './dto/customer.dto';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @RequirePermissions('customer.read')
  @Get()
  list(@Query() query: ListCustomersDto) {
    return this.customers.list(query);
  }

  @RequirePermissions('customer.create')
  @Post()
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customers.create(dto, user.id);
  }

  @RequirePermissions('customer.read')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.customers.getById(id);
  }

  @RequirePermissions('customer.update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customers.update(id, dto, user.id);
  }
}
