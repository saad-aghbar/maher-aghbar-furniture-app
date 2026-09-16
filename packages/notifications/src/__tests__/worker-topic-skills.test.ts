import { ROLE_PERMISSIONS } from '@maher/permissions';
import { TOPICS } from '../topics';
import { eligibleTopicsForUser, isEligibleForTopic } from '../eligibility';
import { workerSkillsMatchTopic } from '../worker-topic-skills';
import type { RecipientUser } from '../types';

function worker(skills: string[]): RecipientUser {
  return {
    id: 'w',
    roles: ['PRODUCTION_WORKER'],
    permissions: [...ROLE_PERMISSIONS.PRODUCTION_WORKER],
    stageSkillCodes: skills,
  };
}

describe('workerSkillsMatchTopic', () => {
  it('always allows personal assignment topics', () => {
    expect(workerSkillsMatchTopic([], 'task.assigned')).toBe(true);
    expect(workerSkillsMatchTopic(['DELIVERY'], 'task.unassigned')).toBe(true);
    expect(workerSkillsMatchTopic(['CARPENTRY'], 'task.urgent')).toBe(true);
  });

  it('gates floor-shared topics on a non-delivery production skill', () => {
    expect(workerSkillsMatchTopic(['CARPENTRY'], 'task.ready')).toBe(true);
    expect(workerSkillsMatchTopic(['PAINTING'], 'blocker.answered')).toBe(true);
    expect(workerSkillsMatchTopic([], 'task.ready')).toBe(false);
    expect(workerSkillsMatchTopic(['DELIVERY'], 'task.ready')).toBe(false);
  });

  it('unions specialty skills', () => {
    expect(workerSkillsMatchTopic(['CARPENTRY'], 'packaging.ready')).toBe(false);
    expect(workerSkillsMatchTopic(['PACKAGING'], 'packaging.ready')).toBe(true);
    expect(workerSkillsMatchTopic(['CARPENTRY', 'PACKAGING'], 'packaging.ready')).toBe(true);
    expect(workerSkillsMatchTopic(['CARPENTRY', 'PACKAGING'], 'task.ready')).toBe(true);
    expect(workerSkillsMatchTopic(['CARPENTRY', 'PACKAGING'], 'quality.queued')).toBe(false);
  });
});

describe('worker skill eligibility', () => {
  it('carpenter-only does not see packaging, QC, or delivery specialty topics', () => {
    const codes = eligibleTopicsForUser(worker(['CARPENTRY']), TOPICS).map((t) => t.code);
    expect(codes).toContain('task.ready');
    expect(codes).toContain('blocker.answered');
    expect(codes).not.toContain('packaging.ready');
    expect(codes).not.toContain('quality.queued');
    expect(codes).not.toContain('delivery.readyToLoad');
    expect(codes).not.toContain('order.confirmed');
    expect(codes).not.toContain('return.submitted');
    expect(codes).not.toContain('po.late');
  });

  it('carpenter + packaging unions floor and packaging topics', () => {
    const codes = eligibleTopicsForUser(worker(['CARPENTRY', 'PACKAGING']), TOPICS).map((t) => t.code);
    expect(codes).toContain('task.ready');
    expect(codes).toContain('packaging.ready');
    expect(codes).not.toContain('quality.queued');
    expect(codes).not.toContain('delivery.readyToLoad');
  });

  it('delivery-only sees delivery topics, not carpentry task.ready', () => {
    const user = worker(['DELIVERY']);
    const codes = eligibleTopicsForUser(user, TOPICS).map((t) => t.code);
    expect(codes).toContain('delivery.readyToLoad');
    expect(codes).toContain('task.assigned');
    expect(codes).not.toContain('task.ready');
    expect(codes).not.toContain('packaging.ready');
    const ready = TOPICS.find((t) => t.code === 'task.ready')!;
    expect(isEligibleForTopic(user, ready)).toBe(false);
  });
});
