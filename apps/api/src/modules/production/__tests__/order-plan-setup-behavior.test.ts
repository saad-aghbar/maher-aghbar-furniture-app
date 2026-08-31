import { behaviorFromFlags } from '../../../common/helpers/inventory-stage-behavior.util';

describe('order plan setup behavior mapping', () => {
  it('maps snapshot flags to stage behaviors used by the plan editor', () => {
    expect(
      behaviorFromFlags({
        inventoryTracking: 'NONE',
        consumesRawMaterials: true,
        consumesSemiFinished: false,
      }),
    ).toBe('USES_MATERIALS');

    expect(
      behaviorFromFlags({
        inventoryTracking: 'PRODUCES_SEMI_FINISHED',
        consumesRawMaterials: true,
        consumesSemiFinished: false,
      }),
    ).toBe('PRODUCES_SEMI_FINISHED');

    expect(
      behaviorFromFlags({
        inventoryTracking: 'PRODUCES_FINISHED',
        consumesRawMaterials: false,
        consumesSemiFinished: true,
      }),
    ).toBe('PRODUCES_FINISHED');
  });
});
