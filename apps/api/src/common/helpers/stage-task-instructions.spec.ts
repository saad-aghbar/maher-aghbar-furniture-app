import { buildStageTaskInstructions } from './stage-task-instructions';

describe('buildStageTaskInstructions', () => {
  it('returns generated stage boilerplate without catalog extras', () => {
    const text = buildStageTaskInstructions({
      stageCode: 'UPHOLSTERY',
      stageNameEn: 'Upholstery',
      productDescription: 'Karina',
      quantity: 1,
    });
    expect(text).toContain('Upholstery for:');
    expect(text).not.toContain('لف بسيط');
  });
});
