import { resolveProductStageOutput } from './product-inventory-output.resolver';
import { InventoryItemClass } from '@maher/database';

describe('resolveProductStageOutput', () => {
  const node = {
    sourceWorkflowNodeId: 'node-carpentry',
    stageDefinitionId: 'stage-carpentry',
    inventoryTracking: 'PRODUCES_SEMI_FINISHED' as const,
    consumesRawMaterials: true,
    consumesSemiFinished: false,
    outputQtyPerUnit: null,
    outputNameAr: null,
    outputNameEn: null,
    outputNameHe: null,
    defaultWarehouseId: null,
  };

  it('uses ProductStageInventoryOutput before inventing a generic name', () => {
    const resolved = resolveProductStageOutput(node, [
      {
        id: 'out-1',
        productId: 'milano',
        workflowNodeId: 'node-carpentry',
        stageDefinitionId: 'stage-carpentry',
        itemClass: InventoryItemClass.SEMI_FINISHED_GOOD,
        outputNameAr: 'هيكل ميلانو',
        outputNameEn: 'Milano Sofa Frame',
        outputNameHe: null,
        outputQtyPerUnit: 1,
        unit: 'pcs',
        defaultWarehouseId: 'semi-wh',
        inventoryItemId: 'frame-item',
      },
    ]);
    expect(resolved.nameEn).toBe('Milano Sofa Frame');
    expect(resolved.qtyPerUnit).toBe(1);
    expect(resolved.inventoryItemId).toBe('frame-item');
    expect(resolved.warehouseId).toBe('semi-wh');
    expect(resolved.outputDefinitionId).toBe('out-1');
  });

  it('lets a product setup row override workflow tracking and consume flags', () => {
    const resolved = resolveProductStageOutput(
      { ...node, inventoryTracking: 'NONE', consumesRawMaterials: false },
      [
        {
          id: 'out-1',
          productId: 'sofa',
          workflowNodeId: 'node-carpentry',
          stageDefinitionId: 'stage-carpentry',
          itemClass: InventoryItemClass.SEMI_FINISHED_GOOD,
          inventoryTracking: 'PRODUCES_SEMI_FINISHED',
          consumesRawMaterials: true,
          consumesSemiFinished: false,
          outputNameAr: 'هيكل',
          outputNameEn: 'Frame',
          outputNameHe: null,
          outputQtyPerUnit: 1,
          unit: 'pcs',
          defaultWarehouseId: 'semi-wh',
          inventoryItemId: 'frame-item',
        },
      ],
    );
    expect(resolved.tracking).toBe('PRODUCES_SEMI_FINISHED');
    expect(resolved.consumesRawMaterials).toBe(true);
    expect(resolved.produces).toBe(true);
    expect(resolved.nameEn).toBe('Frame');
  });

  it('lets snapshotted node qty/name override the product row', () => {
    const resolved = resolveProductStageOutput(
      { ...node, outputQtyPerUnit: 1, outputNameEn: 'Order Frame' },
      [
        {
          id: 'out-1',
          productId: 'milano',
          workflowNodeId: 'node-carpentry',
          stageDefinitionId: 'stage-carpentry',
          itemClass: InventoryItemClass.SEMI_FINISHED_GOOD,
          outputNameAr: 'هيكل',
          outputNameEn: 'Catalog Frame',
          outputNameHe: null,
          outputQtyPerUnit: 2,
          unit: 'pcs',
          defaultWarehouseId: 'semi-wh',
          inventoryItemId: 'frame-item',
        },
      ],
    );
    expect(resolved.nameEn).toBe('Order Frame');
    expect(resolved.qtyPerUnit).toBe(1);
  });

  it('does not invent output when tracking is NONE and no product row exists', () => {
    const resolved = resolveProductStageOutput({
      ...node,
      inventoryTracking: 'NONE',
      consumesRawMaterials: false,
    });
    expect(resolved.produces).toBe(false);
    expect(resolved.nameEn).toBeNull();
    expect(resolved.inventoryItemId).toBeNull();
  });
});
