import {
  planOpeningChainAppend,
  validateOpeningChain,
  OPENING_STAGE_CODE,
} from '../domain/opening-chain';

describe('validateOpeningChain', () => {
  it('requires MATERIAL_PREP', () => {
    const issues = validateOpeningChain(
      [{ id: '1', nodeKey: 'carp', stageCode: 'CARPENTRY', isRequired: true }],
      [],
    );
    expect(issues.some((i) => i.code === 'OPENING_CHAIN_MISSING')).toBe(true);
  });

  it('rejects inbound edges on MATERIAL_PREP', () => {
    const issues = validateOpeningChain(
      [
        { id: 'prep', nodeKey: 'prep', stageCode: OPENING_STAGE_CODE, isRequired: true },
        { id: 'carp', nodeKey: 'carp', stageCode: 'CARPENTRY', isRequired: true },
      ],
      [{ fromNodeId: 'carp', toNodeId: 'prep' }],
    );
    expect(issues.some((i) => i.code === 'OPENING_CHAIN_NOT_ROOT')).toBe(true);
  });

  it('accepts root MATERIAL_PREP', () => {
    const issues = validateOpeningChain(
      [
        { id: 'prep', nodeKey: 'prep', stageCode: OPENING_STAGE_CODE, isRequired: true },
        { id: 'carp', nodeKey: 'carp', stageCode: 'CARPENTRY', isRequired: true },
      ],
      [{ fromNodeId: 'prep', toNodeId: 'carp' }],
    );
    expect(issues).toEqual([]);
  });
});

describe('planOpeningChainAppend', () => {
  it('plans add when missing', () => {
    expect(planOpeningChainAppend([{ stageCode: 'CARPENTRY' }])).toEqual({
      addStageCode: OPENING_STAGE_CODE,
    });
  });

  it('is idempotent when present', () => {
    expect(planOpeningChainAppend([{ stageCode: OPENING_STAGE_CODE }])).toEqual({
      addStageCode: null,
    });
  });
});
