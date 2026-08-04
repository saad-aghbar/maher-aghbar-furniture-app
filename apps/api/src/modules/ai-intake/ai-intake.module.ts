import { Module } from '@nestjs/common';
import { AiIntakeService } from './ai-intake.service';
import { AiIntakeController } from './ai-intake.controller';

@Module({
  controllers: [AiIntakeController],
  providers: [AiIntakeService],
  exports: [AiIntakeService],
})
export class AiIntakeModule {}
