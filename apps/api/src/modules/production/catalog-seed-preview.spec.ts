import { scaleMaterialQty } from '../scheduling/domain/material-readiness';
import {
  bomMaterialCount,
  catalogSeedRequiresWorkflowConfirm,
  countExecutableWorkflowTasks,
  countSemiWipOutputs,
  fabricLabelFromSpec,
  hasUsableCatalogProductionDefinition,
  isProductionOrderLocked,
  modifiedMaterialsReviewRequired,
  resolveLinePlanType,
  standardCatalogSeedActionAvailable,
} from './catalog-seed-preview';

describe('catalog seed preview helpers', () => {
  it('shows the action when STANDARD or MODIFIED + product + usable template + editable', () => {
    expect(
      standardCatalogSeedActionAvailable({
        manufacturingComplexity: 'STANDARD',
        productId: 'p1',
        usableDefinition: true,
        planEditable: true,
        factoryLocked: false,
      }),
    ).toBe(true);
    expect(
      standardCatalogSeedActionAvailable({
        manufacturingComplexity: 'MODIFIED',
        productId: 'p1',
        usableDefinition: true,
        planEditable: true,
        factoryLocked: false,
      }),
    ).toBe(true);
  });

  it('hides the action when there is no usable catalog definition', () => {
    expect(
      standardCatalogSeedActionAvailable({
        manufacturingComplexity: 'STANDARD',
        productId: 'p1',
        usableDefinition: false,
        planEditable: true,
        factoryLocked: false,
      }),
    ).toBe(false);
  });

  it('does not treat fabric or color as availability inputs', () => {
    const available = standardCatalogSeedActionAvailable({
      manufacturingComplexity: 'STANDARD',
      productId: 'p1',
      usableDefinition: true,
      planEditable: true,
      factoryLocked: false,
    });
    expect(available).toBe(true);
    expect(fabricLabelFromSpec({ fabric: { type: 'Velvet', color: 'Beige' } })).toBe(
      'Velvet · Beige',
    );
  });

  it('hides the action for CUSTOM even with a product and usable definition', () => {
    expect(
      standardCatalogSeedActionAvailable({
        manufacturingComplexity: 'CUSTOM',
        productId: 'p1',
        usableDefinition: true,
        planEditable: true,
        factoryLocked: false,
      }),
    ).toBe(false);
  });

  it('locks released and started production orders', () => {
    expect(isProductionOrderLocked({ releasedToFactoryAt: new Date(), status: 'PLANNED' })).toBe(
      true,
    );
    expect(isProductionOrderLocked({ actualStartDate: new Date(), status: 'PLANNED' })).toBe(true);
    expect(isProductionOrderLocked({ status: 'IN_PROGRESS' })).toBe(true);
    expect(isProductionOrderLocked({ status: 'PLANNED' })).toBe(false);
  });

  it('requires a second confirmation only when an existing PO would change workflow', () => {
    expect(
      catalogSeedRequiresWorkflowConfirm({
        hasProductionOrder: true,
        currentWorkflowId: 'custom-sofa',
        catalogWorkflowId: 'standard-furniture',
      }),
    ).toBe(true);
    expect(
      catalogSeedRequiresWorkflowConfirm({
        hasProductionOrder: true,
        currentWorkflowId: 'standard-furniture',
        catalogWorkflowId: 'standard-furniture',
      }),
    ).toBe(false);
    expect(
      catalogSeedRequiresWorkflowConfirm({
        hasProductionOrder: false,
        currentWorkflowId: 'custom-sofa',
        catalogWorkflowId: 'standard-furniture',
      }),
    ).toBe(false);
  });

  it('treats a published workflow with nodes or materials as a usable definition', () => {
    expect(
      hasUsableCatalogProductionDefinition({
        workflowId: 'wf-1',
        published: true,
        nodeCount: 7,
        stageMaterialInputCount: 0,
        bomMaterialCount: 0,
        stageInventoryOutputCount: 0,
      }),
    ).toBe(true);
    expect(
      hasUsableCatalogProductionDefinition({
        workflowId: 'wf-1',
        published: true,
        nodeCount: 0,
        stageMaterialInputCount: 12,
        bomMaterialCount: 0,
        stageInventoryOutputCount: 3,
      }),
    ).toBe(true);
    expect(
      hasUsableCatalogProductionDefinition({
        workflowId: 'wf-1',
        published: false,
        nodeCount: 7,
        stageMaterialInputCount: 12,
      }),
    ).toBe(false);
    expect(
      hasUsableCatalogProductionDefinition({
        workflowId: null,
        published: true,
        nodeCount: 7,
      }),
    ).toBe(false);
  });

  it('honors QuantityScalingMode instead of always multiplying by order qty', () => {
    expect(scaleMaterialQty(4, 2, 'LINEAR')).toBe(8);
    expect(scaleMaterialQty(4, 2, 'FIXED')).toBe(4);
    expect(scaleMaterialQty(4, 2, null)).toBe(8);
    expect(scaleMaterialQty(2, 3, 'LINEAR')).not.toBe(2);
  });

  it('counts executable tasks and SEMI outputs from the product definition', () => {
    expect(
      countExecutableWorkflowTasks([
        { executionKind: 'PRODUCTION' },
        { executionKind: 'LOGISTICS' },
        { executionKind: 'PRODUCTION' },
      ]),
    ).toBe(2);
    expect(
      countSemiWipOutputs([
        { inventoryTracking: 'PRODUCES_SEMI_FINISHED' },
        { inventoryTracking: 'PRODUCES_FINISHED' },
        { inventoryTracking: 'PRODUCES_SEMI_FINISHED' },
      ]),
    ).toBe(2);
    expect(bomMaterialCount({ materials: [{ sku: 'WOOD' }, { sku: 'FOAM' }] })).toBe(2);
  });

  it('resolves null complexity from productId', () => {
    expect(resolveLinePlanType({ manufacturingComplexity: null, productId: 'p1' })).toBe(
      'STANDARD',
    );
    expect(resolveLinePlanType({ manufacturingComplexity: null, productId: null })).toBe(
      'CUSTOM',
    );
  });

  it('requires explicit materials review for MODIFIED until stamped', () => {
    expect(
      modifiedMaterialsReviewRequired({
        manufacturingComplexity: 'MODIFIED',
        materialsReviewedAt: null,
      }),
    ).toBe(true);
    expect(
      modifiedMaterialsReviewRequired({
        manufacturingComplexity: 'MODIFIED',
        materialsReviewedAt: new Date(),
        materialsNeedReview: true,
      }),
    ).toBe(true);
    expect(
      modifiedMaterialsReviewRequired({
        manufacturingComplexity: 'MODIFIED',
        materialsReviewedAt: new Date(),
        materialsNeedReview: false,
      }),
    ).toBe(false);
    expect(
      modifiedMaterialsReviewRequired({
        manufacturingComplexity: 'STANDARD',
        materialsReviewedAt: null,
      }),
    ).toBe(false);
  });
});
