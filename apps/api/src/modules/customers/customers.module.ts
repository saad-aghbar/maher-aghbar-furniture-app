import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomerRelationsController } from './customer-relations.controller';
import { CustomersService } from './customers.service';

@Module({
  controllers: [CustomersController, CustomerRelationsController],
  providers: [CustomersService],
})
export class CustomersModule {}
