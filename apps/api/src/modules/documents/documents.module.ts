import { Module } from '@nestjs/common';
import { LocalStorageService } from '../../integrations/storage/local-storage.service';
import { UploadsController } from './uploads.controller';
import { PdfController } from './pdf.controller';

@Module({
  controllers: [UploadsController, PdfController],
  providers: [LocalStorageService],
  exports: [LocalStorageService],
})
export class DocumentsModule {}
