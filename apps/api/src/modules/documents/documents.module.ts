import { Module, forwardRef } from '@nestjs/common';
import { LocalStorageService } from '../../integrations/storage/local-storage.service';
import { UploadsController } from './uploads.controller';
import { PdfController } from './pdf.controller';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [forwardRef(() => InventoryModule)],
  controllers: [UploadsController, PdfController],
  providers: [LocalStorageService],
  exports: [LocalStorageService],
})
export class DocumentsModule {}
