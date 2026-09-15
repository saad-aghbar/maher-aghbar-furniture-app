import { classifyReadyHandoff } from './floor-handoff.classify';

describe('classifyReadyHandoff', () => {
  it('routes inspection to quality.queued, packaging to packaging.ready, else task.ready', () => {
    expect(classifyReadyHandoff({ stageCode: 'INSPECTION', executionKind: 'QUALITY' })).toBe(
      'quality.queued',
    );
    expect(classifyReadyHandoff({ stageCode: 'PACKAGING', executionKind: 'PRODUCTION' })).toBe(
      'packaging.ready',
    );
    expect(classifyReadyHandoff({ stageCode: 'CARPENTRY', executionKind: 'PRODUCTION' })).toBe(
      'task.ready',
    );
  });
});
