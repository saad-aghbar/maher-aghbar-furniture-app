import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PatchLineSetupDto {
  @IsOptional()
  @IsString()
  manufacturingName?: string;

  @IsOptional()
  @IsString()
  factoryNotes?: string | null;

  @IsOptional()
  orderDimensions?: {
    width?: number | null;
    height?: number | null;
    depth?: number | null;
    seatHeight?: number | null;
  };

  /** Extensible named measurements [{ key, label, value, unit, catalogValue? }] */
  @IsOptional()
  @IsArray()
  measurements?: Array<{
    key: string;
    label: string;
    value?: number | string | null;
    unit?: string | null;
    catalogValue?: number | string | null;
  }>;

  @IsOptional()
  @IsEnum(['STANDARD', 'MODIFIED', 'CUSTOM'])
  manufacturingComplexity?: 'STANDARD' | 'MODIFIED' | 'CUSTOM';

  @IsOptional()
  packagingExpectation?: {
    pieceLabels?: Array<{ label?: string; nameEn?: string; nameAr?: string; nameHe?: string }>;
    expectedPieceCount?: number | null;
  };

  @IsOptional()
  @IsUUID()
  workflowId?: string | null;

  @IsOptional()
  @IsBoolean()
  confirmWorkflow?: boolean;

  @IsOptional()
  @IsBoolean()
  materialsReviewed?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referenceDocumentIds?: string[];

  @IsOptional()
  @IsString()
  requestedFabricLabel?: string | null;
}

export class MaterialRequirementInputDto {
  @IsOptional()
  @IsUUID()
  inventoryItemId?: string | null;

  @IsOptional()
  @IsString()
  sku?: string | null;

  @IsOptional()
  @IsString()
  displayName?: string | null;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsNumber()
  @Min(0)
  expectedQty!: number;

  @IsOptional()
  @IsEnum(['CATALOG', 'FACTORY_MODIFIED', 'CUSTOM'])
  source?: 'CATALOG' | 'FACTORY_MODIFIED' | 'CUSTOM';

  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsString()
  requestedFabricLabel?: string | null;
}

export class PutLineMaterialsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialRequirementInputDto)
  materials!: MaterialRequirementInputDto[];
}

export class SeedFromCatalogDto {
  /** Required when the catalog workflow differs from the current order workflow. */
  @IsOptional()
  @IsBoolean()
  confirmWorkflowChange?: boolean;
}
