import { assignWorker, isEligible, listEligibleWorkers } from '../worker-assignment';
import type { WorkerCandidate } from '../types';

const carpentry: WorkerCandidate = {
  id: 'w-carp',
  isActive: true,
  departmentCode: 'PAINT',
  skillStageDefinitionIds: ['stg-carpentry'],
};

const painter: WorkerCandidate = {
  id: 'w-paint',
  isActive: true,
  departmentCode: 'CARPENTRY',
  skillStageDefinitionIds: ['stg-painting'],
};

const multiSkill: WorkerCandidate = {
  id: 'w-multi',
  isActive: true,
  departmentCode: null,
  skillStageDefinitionIds: ['stg-carpentry', 'stg-painting', 'stg-foam'],
};

const unskilled: WorkerCandidate = {
  id: 'w-none',
  isActive: true,
  departmentCode: 'CARPENTRY',
  skillStageDefinitionIds: [],
};

const inactive: WorkerCandidate = {
  id: 'w-off',
  isActive: false,
  departmentCode: null,
  skillStageDefinitionIds: ['stg-carpentry'],
};

describe('worker-assignment eligibility (skills-only)', () => {
  it('matches workers by stage skill regardless of department', () => {
    expect(isEligible(carpentry, 'CARPENTRY', 'stg-carpentry')).toBe(true);
    expect(isEligible(carpentry, 'PAINT', 'stg-carpentry')).toBe(true);
    expect(isEligible(painter, 'CARPENTRY', 'stg-carpentry')).toBe(false);
  });

  it('excludes workers missing the required skill', () => {
    expect(isEligible(painter, null, 'stg-carpentry')).toBe(false);
    expect(isEligible(unskilled, 'CARPENTRY', 'stg-carpentry')).toBe(false);
  });

  it('excludes inactive workers', () => {
    expect(isEligible(inactive, null, 'stg-carpentry')).toBe(false);
  });

  it('allows any active worker when no stage is specified', () => {
    expect(isEligible(unskilled, 'CARPENTRY', null)).toBe(true);
    expect(isEligible(inactive, null, null)).toBe(false);
  });

  it('listEligibleWorkers returns only skill-matched workers', () => {
    const eligible = listEligibleWorkers({
      workers: [carpentry, painter, multiSkill, unskilled, inactive],
      departmentCode: 'CARPENTRY',
      stageDefinitionId: 'stg-carpentry',
    });
    expect(eligible.map((w) => w.id)).toEqual(['w-carp', 'w-multi']);
  });

  it('assignWorker prefers least-loaded eligible worker', () => {
    const loaded: WorkerCandidate = {
      ...carpentry,
      loadedMinutes: 120,
    };
    const free: WorkerCandidate = {
      ...multiSkill,
      loadedMinutes: 0,
    };
    const picked = assignWorker({
      workers: [loaded, free],
      departmentCode: 'IGNORED',
      stageDefinitionId: 'stg-carpentry',
    });
    expect(picked?.id).toBe('w-multi');
  });
});
