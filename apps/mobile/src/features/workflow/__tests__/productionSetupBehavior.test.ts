import {
  coerceSetupProduceKind,
  deriveSetupBehavior,
  isDeliverySetupStage,
  isInspectionSetupStage,
  isPackagingSetupStage,
  produceKindFromBehavior,
  terminalSetupMode,
} from '../productionSetupBehavior';

describe('productionSetupBehavior', () => {
  it('allows taking semi and producing semi together', () => {
    expect(
      deriveSetupBehavior({
        consumeRaw: true,
        consumeSemi: true,
        produce: 'semi',
      }),
    ).toBe('USES_AND_PRODUCES');
  });

  it('maps materials-only to USES_MATERIALS', () => {
    expect(
      deriveSetupBehavior({
        consumeRaw: true,
        consumeSemi: false,
        produce: 'none',
      }),
    ).toBe('USES_MATERIALS');
  });

  it('maps finished produce independently of semi consume', () => {
    expect(
      deriveSetupBehavior({
        consumeRaw: false,
        consumeSemi: true,
        produce: 'finished',
      }),
    ).toBe('PRODUCES_FINISHED');
  });

  it('round-trips produce kind from behavior', () => {
    expect(produceKindFromBehavior('USES_AND_PRODUCES')).toBe('semi');
    expect(produceKindFromBehavior('PRODUCES_FINISHED')).toBe('finished');
    expect(produceKindFromBehavior('USES_MATERIALS')).toBe('none');
  });

  it('classifies terminal setup modes', () => {
    expect(terminalSetupMode('INSPECTION')).toBe('inspection');
    expect(terminalSetupMode('PACKAGING')).toBe('packaging');
    expect(terminalSetupMode('pack')).toBe('packaging');
    expect(terminalSetupMode('DELIVERY')).toBe('delivery');
    expect(terminalSetupMode('CARPENTRY')).toBe('production');
    expect(isInspectionSetupStage('inspection')).toBe(true);
    expect(isDeliverySetupStage('DELIVERY')).toBe(true);
    expect(isPackagingSetupStage('pack')).toBe(true);
  });

  it('restricts finished goods to packaging and SEMI to other stages', () => {
    expect(coerceSetupProduceKind('finished', 'PACKAGING')).toBe('finished');
    expect(coerceSetupProduceKind('semi', 'PACKAGING')).toBe('finished');
    expect(coerceSetupProduceKind('none', 'PACKAGING')).toBe('finished');
    expect(coerceSetupProduceKind('finished', 'CARPENTRY')).toBe('semi');
    expect(coerceSetupProduceKind('semi', 'CARPENTRY')).toBe('semi');
  });

  it('forces inspection and delivery to make nothing', () => {
    expect(coerceSetupProduceKind('semi', 'INSPECTION')).toBe('none');
    expect(coerceSetupProduceKind('finished', 'INSPECTION')).toBe('none');
    expect(coerceSetupProduceKind('semi', 'DELIVERY')).toBe('none');
    expect(coerceSetupProduceKind('finished', 'DELIVERY')).toBe('none');
  });
});
