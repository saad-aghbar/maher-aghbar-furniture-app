import { describe, expect, it } from 'vitest';
import { allPackagesConfirmed, classifyTaskQualityKind, countPriorFails, isRecoveryFinishBlocked } from './task-quality-kind';

describe('classifyTaskQualityKind', () => {
  it('classifies gates, packaging, rework and recovery', () => {
    expect(classifyTaskQualityKind({ stageCode: 'INSPECTION' })).toBe('inspection');
    expect(classifyTaskQualityKind({ stageCode: 'INSPECTION', priorFailCount: 1 })).toBe('reinspection');
    expect(classifyTaskQualityKind({ executionKind: 'QUALITY' })).toBe('inspection');
    expect(classifyTaskQualityKind({ stageCode: 'PACKAGING' })).toBe('packaging');
    expect(classifyTaskQualityKind({ executionKind: 'PACKAGING' })).toBe('packaging');
    expect(classifyTaskQualityKind({ stageCode: 'DISMANTLE_RECOVER' })).toBe('recovery');
    expect(classifyTaskQualityKind({ stageCode: 'CARPENTRY', isRework: true })).toBe('rework');
    expect(classifyTaskQualityKind({ stageCode: 'CARPENTRY' })).toBe('production');
  });

  it('counts prior fails from inspection history', () => {
    expect(countPriorFails([{ result: 'PASSED' }, { result: 'FAILED_REWORK_REQUIRED' }, { result: 'BLOCKED' }])).toBe(2);
    expect(countPriorFails(null)).toBe(0);
  });

  it('blocks recovery finish until every line is posted', () => {
    expect(isRecoveryFinishBlocked([])).toBe(true);
    expect(isRecoveryFinishBlocked([{ postedAt: null }])).toBe(true);
    expect(isRecoveryFinishBlocked([{ postedAt: '2026-09-01' }])).toBe(false);
  });

  it('requires every expected package to be confirmed', () => {
    expect(allPackagesConfirmed([], {})).toBe(true);
    expect(allPackagesConfirmed([{ code: 'A' }, { code: 'B' }], { A: true })).toBe(false);
    expect(allPackagesConfirmed([{ code: 'A' }, { code: 'B' }], { A: true, B: true })).toBe(true);
  });
});
