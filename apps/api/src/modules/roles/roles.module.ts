import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { StaffTypesController } from './staff-types.controller';

@Module({
  controllers: [RolesController, StaffTypesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
