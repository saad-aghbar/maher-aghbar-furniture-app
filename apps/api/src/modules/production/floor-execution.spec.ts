import {
  classifyFloorTaskPhase,
  groupIncomingByPredecessorStage,
  presentCustody,
  isWipDiscrepancyCategory,
} from './floor-execution';
import { incomingWorkStatus } from './workflow/domain/wip-handoff';

describe('Piece 8 floor execution presentation', () => {
  describe('classifyFloorTaskPhase', () => {
    it('first stage / no SEMI → READY_TO_START + START', () => {
      const p = classifyFloorTaskPhase({
        taskStatus: 'READY',
        consumesSemi: false,
        incomingRequired: false,
      });
      expect(p.phase).toBe('READY_TO_START');
      expect(p.primaryAction).toBe('START');
    });

    it('needs SEMI waiting production → WAITING_PREVIOUS', () => {
      const p = classifyFloorTaskPhase({
        taskStatus: 'READY',
        incomingRequired: true,
        allReceived: false,
        anyWaitingProduction: true,
        anyReadyToCollect: false,
      });
      expect(p.phase).toBe('WAITING_PREVIOUS');
      expect(p.primaryAction).toBe('NONE');
    });

    it('SEMI ready to collect → READY_TO_RECEIVE + RECEIVE_SEMI', () => {
      const p = classifyFloorTaskPhase({
        taskStatus: 'NOT_STARTED',
        incomingRequired: true,
        allReceived: false,
        anyReadyToCollect: true,
      });
      expect(p.phase).toBe('READY_TO_RECEIVE');
      expect(p.primaryAction).toBe('RECEIVE_SEMI');
    });

    it('all received → READY_TO_START', () => {
      const p = classifyFloorTaskPhase({
        taskStatus: 'READY',
        incomingRequired: true,
        allReceived: true,
      });
      expect(p.phase).toBe('READY_TO_START');
      expect(p.primaryAction).toBe('START');
    });

    it('in progress → COMPLETE; blockers → ATTENTION', () => {
      expect(
        classifyFloorTaskPhase({ taskStatus: 'IN_PROGRESS' }).primaryAction,
      ).toBe('COMPLETE');
      expect(
        classifyFloorTaskPhase({
          taskStatus: 'READY',
          openBlockerCount: 1,
        }).phase,
      ).toBe('ATTENTION');
    });
  });

  describe('groupIncomingByPredecessorStage', () => {
    it('keeps parallel lanes independent', () => {
      const lanes = groupIncomingByPredecessorStage([
        {
          fromStageCode: 'CARPENTRY',
          fromStageNameEn: 'Carpentry',
          fromStageNameAr: null,
          fromStageNameHe: null,
          statusKey: 'RECEIVED' as const,
          expected: 1,
          received: 1,
          produced: 1,
          outstanding: 0,
        },
        {
          fromStageCode: 'FOAM',
          fromStageNameEn: 'Foam Prep',
          fromStageNameAr: null,
          fromStageNameHe: null,
          statusKey: 'WAITING_PRODUCTION' as const,
          expected: 1,
          received: 0,
          produced: 0,
          outstanding: 1,
        },
      ]);
      expect(lanes).toHaveLength(2);
      expect(lanes.find((l) => l.fromStageCode === 'CARPENTRY')?.statusKey).toBe(
        'RECEIVED',
      );
      expect(lanes.find((l) => l.fromStageCode === 'FOAM')?.statusKey).toBe(
        'WAITING_PRODUCTION',
      );
    });

    it('partial X of Y does not pretend complete', () => {
      expect(incomingWorkStatus({ produced: 4, received: 4, expected: 6 })).toBe(
        'PARTIALLY_RECEIVED',
      );
      expect(incomingWorkStatus({ produced: 6, received: 6, expected: 6 })).toBe(
        'RECEIVED',
      );
    });
  });

  describe('presentCustody', () => {
    it('maps READY → PRODUCED_WAITING', () => {
      expect(presentCustody({ status: 'READY', handoffCount: 0 }).phase).toBe(
        'PRODUCED_WAITING',
      );
    });
    it('maps CLAIMED → RECEIVED', () => {
      expect(presentCustody({ status: 'CLAIMED', handoffCount: 1 }).phase).toBe(
        'RECEIVED',
      );
    });
    it('maps CONSUMED → IN_WORK', () => {
      expect(presentCustody({ status: 'CONSUMED', handoffCount: 1 }).phase).toBe(
        'IN_WORK',
      );
    });
  });

  describe('discrepancy categories', () => {
    it('accepts known categories only', () => {
      expect(isWipDiscrepancyCategory('DAMAGED')).toBe(true);
      expect(isWipDiscrepancyCategory('FAKE')).toBe(false);
    });
  });
});
