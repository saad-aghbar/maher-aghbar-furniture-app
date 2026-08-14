import {
  behaviorFromFlags,
  flagsFromBehaviorWithConsume,
  itemClassForBehavior,
} from './inventory-stage-behavior.util';

describe('inventory-stage-behavior', () => {
  it('maps human-readable choices onto tracking flags', () => {
    expect(flagsFromBehaviorWithConsume('NONE')).toEqual({
      inventoryTracking: 'NONE',
      consumesRawMaterials: false,
      consumesSemiFinished: false,
    });
    expect(flagsFromBehaviorWithConsume('USES_MATERIALS')).toMatchObject({
      consumesRawMaterials: true,
      inventoryTracking: 'NONE',
    });
    expect(flagsFromBehaviorWithConsume('PRODUCES_SEMI_FINISHED', { consumesRawMaterials: true }))
      .toMatchObject({
        inventoryTracking: 'PRODUCES_SEMI_FINISHED',
        consumesRawMaterials: true,
        consumesSemiFinished: false,
      });
    expect(flagsFromBehaviorWithConsume('USES_SEMI_FINISHED')).toMatchObject({
      consumesSemiFinished: true,
      inventoryTracking: 'NONE',
    });
    expect(flagsFromBehaviorWithConsume('USES_AND_PRODUCES')).toMatchObject({
      inventoryTracking: 'PRODUCES_SEMI_FINISHED',
      consumesSemiFinished: true,
    });
    expect(
      flagsFromBehaviorWithConsume('PRODUCES_FINISHED', { consumesSemiFinished: true }),
    ).toMatchObject({
      inventoryTracking: 'PRODUCES_FINISHED',
      consumesSemiFinished: true,
    });
  });

  it('round-trips produce + consume combinations', () => {
    const flags = flagsFromBehaviorWithConsume('USES_AND_PRODUCES', { consumesRawMaterials: true });
    expect(behaviorFromFlags(flags)).toBe('USES_AND_PRODUCES');
    expect(itemClassForBehavior('PRODUCES_FINISHED')).toBe('FINISHED_GOOD');
    expect(itemClassForBehavior('PRODUCES_SEMI_FINISHED')).toBe('SEMI_FINISHED_GOOD');
  });
});
