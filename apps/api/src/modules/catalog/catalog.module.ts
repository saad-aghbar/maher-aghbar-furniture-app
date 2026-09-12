import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { VariantsController } from './variants.controller';
import { VariantsService } from './variants.service';
import { CatalogPromotionService } from './catalog-promotion.service';
import { TranslationService } from './translation.service';

@Module({
  controllers: [CatalogController, VariantsController],
  providers: [VariantsService, CatalogPromotionService, TranslationService],
  exports: [VariantsService, CatalogPromotionService, TranslationService],
})
export class CatalogModule {}
