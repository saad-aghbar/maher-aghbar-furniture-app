import {
  DEFECT_CATEGORY_STAGE_HINT,
  buildInspectionDealerDetails,
  buildManufacturingSpecForFloor,
  isInspectionStageCode,
  isPackagingStageCode,
  isQcPassResult,
  isQualityExecutionKind,
  recommendReworkStage,
  type EligibleReworkStage,
} from './quality-floor';

describe('quality-floor', () => {
  it('classifies QUALITY execution and inspection/packaging codes', () => {
    expect(isQualityExecutionKind('QUALITY')).toBe(true);
    expect(isQualityExecutionKind('PRODUCTION')).toBe(false);
    expect(isInspectionStageCode('INSPECTION')).toBe(true);
    expect(isPackagingStageCode('PACKAGING')).toBe(true);
    expect(isQcPassResult('PASSED')).toBe(true);
    expect(isQcPassResult('FAILED_REWORK_REQUIRED')).toBe(false);
  });

  it('recommends Upholstery for stitching/fabric categories', () => {
    const stages: EligibleReworkStage[] = [
      { stageInstanceId: 'c', stageCode: 'CARPENTRY', nameEn: 'Carpentry', executionKind: 'PRODUCTION' },
      { stageInstanceId: 'a', stageCode: 'ASSEMBLY', nameEn: 'Assembly', executionKind: 'PRODUCTION' },
      { stageInstanceId: 'u', stageCode: 'UPHOLSTERY', nameEn: 'Upholstery', executionKind: 'PRODUCTION' },
      { stageInstanceId: 'i', stageCode: 'INSPECTION', nameEn: 'Inspection', executionKind: 'QUALITY' },
      { stageInstanceId: 'p', stageCode: 'PACKAGING', nameEn: 'Packaging', executionKind: 'PRODUCTION' },
    ];
    const { recommended, eligible } = recommendReworkStage({ category: 'UPHOLSTERY', stages });
    expect(eligible.map((e) => e.stageCode)).toEqual(['CARPENTRY', 'ASSEMBLY', 'UPHOLSTERY']);
    expect(recommended?.stageCode).toBe('UPHOLSTERY');
  });

  it('recommends Carpentry for dimension defects', () => {
    const stages: EligibleReworkStage[] = [
      { stageInstanceId: 'c', stageCode: 'CARPENTRY', nameEn: 'Carpentry', executionKind: 'PRODUCTION' },
      { stageInstanceId: 'a', stageCode: 'ASSEMBLY', nameEn: 'Assembly', executionKind: 'PRODUCTION' },
    ];
    const { recommended } = recommendReworkStage({ category: 'DIMENSIONS', stages });
    expect(recommended?.stageCode).toBe('CARPENTRY');
  });

  it('exposes category→stage hints for furniture factory', () => {
    expect(DEFECT_CATEGORY_STAGE_HINT.FABRIC[0]).toBe('UPHOLSTERY');
  });

  it('builds inspector spec from fabricRole, dims, and orderSpec color', () => {
    const spec = buildManufacturingSpecForFloor({
      setup: {
        manufacturingComplexity: 'MODIFIED',
        manufacturingName: 'Luna sofa — wide',
        factoryNotes: 'Match dealer sample',
        requestedFabricLabel: 'Velvet Navy',
        orderDimensions: { width: 220, height: 85, depth: 95, seatHeight: 44 },
        catalogDimensions: { width: 200, height: 85, depth: 95, seatHeight: 44 },
        materialRequirements: [
          {
            fabricRole: 'COVER',
            displayName: 'Velvet Navy',
            sku: 'FAB-NVY',
            category: 'OTHER',
            expectedQty: 12,
            unit: 'm',
            inventoryItem: { nameEn: 'Velvet Navy', nameHe: 'קטיפה', sku: 'FAB-NVY', unit: 'm' },
          },
          {
            category: 'WOOD',
            displayName: 'Oak frame',
            sku: 'WD-OAK',
            expectedQty: 1,
            unit: 'pcs',
          },
        ],
      },
      salesOrderLine: {
        specifications: 'Wider arms',
        orderSpec: { fabric: { type: 'Velvet', code: 'V-302', color: 'Navy' } },
      },
    });
    expect(spec.fabric?.nameEn).toBe('Velvet Navy');
    expect(spec.fabric?.sku).toBe('FAB-NVY');
    expect(spec.color).toBe('Navy');
    expect(spec.wood?.nameEn).toBe('Oak frame');
    expect(spec.orderDimensions).toMatchObject({ width: 220, height: 85, seatHeight: 44 });
    expect(spec.lineSpec).toBe('Wider arms');
    expect(spec.complexity).toBe('MODIFIED');
    expect(spec.changesFromCatalog.some((row) => row.field === 'width')).toBe(true);
  });

  it('falls back to orderSpec fabric and requested dimensions', () => {
    const spec = buildManufacturingSpecForFloor({
      salesOrderLine: {
        orderSpec: {
          requestedDimensions: { width: 210, height: 82, depth: 90 },
          fabric: { type: 'Linen', color: 'Ivory' },
        },
      },
      product: { width: 200, height: 80, depth: 90, seatHeight: 45 },
    });
    expect(spec.fabric?.nameEn).toBe('Linen');
    expect(spec.color).toBe('Ivory');
    expect(spec.orderDimensions).toMatchObject({ width: 210, height: 82 });
    expect(spec.catalogDimensions).toMatchObject({ seatHeight: 45, width: 200 });
  });

  it('reads dealer fabric, foam, and photos from the commercial order', () => {
    const details = buildInspectionDealerDetails({
      productName: 'Luna sofa',
      productImageUrl: 'https://cdn.example/catalog.jpg',
      projectName: 'Villa lobby',
      dealerNotes: 'Match sample',
      requestItem: {
        productName: 'Luna sofa',
        fabricType: 'Velvet',
        fabricColor: 'Navy',
        foamDensity: '35kg',
        width: 220,
        height: 85,
        depth: 95,
        notes: 'Wider arms',
      },
      documents: [
        { id: 'doc-1', mimeType: 'image/jpeg', fileName: 'sample.jpg' },
        { id: 'doc-2', mimeType: 'application/pdf', fileName: 'po.pdf' },
      ],
    });
    expect(details.fabricType).toBe('Velvet');
    expect(details.fabricColor).toBe('Navy');
    expect(details.foamDensity).toBe('35kg');
    expect(details.width).toBe('220');
    expect(details.photoDocumentIds).toEqual(['doc-1']);
    expect(details.imageUrls[0]).toBe('https://cdn.example/catalog.jpg');
    expect(details.lineNotes).toBe('Wider arms');
  });
});
