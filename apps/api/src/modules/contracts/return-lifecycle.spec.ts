import { BadRequestException } from '@nestjs/common';
import {
  applyLifecycle,
  approvedReturnResolution,
  canTransition,
  deriveLifecycleFromLegacy,
  legacyFieldsFromLifecycle,
} from './return-lifecycle';

describe('return lifecycle', () => {
  it('allows the factory journey and blocks jumps', () => {
    expect(canTransition('REQUESTED', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'IN_TRANSIT')).toBe(true);
    expect(canTransition('IN_TRANSIT', 'RECEIVED')).toBe(true);
    expect(canTransition('RECEIVED', 'REWORKING')).toBe(true);
    expect(canTransition('REWORKING', 'READY_TO_RETURN')).toBe(true);
    expect(canTransition('REQUESTED', 'REWORKING')).toBe(false);
    expect(canTransition('COMPLETED', 'APPROVED')).toBe(false);
    expect(canTransition('REJECTED', 'APPROVED')).toBe(false);
  });

  it('treats a no-op as allowed', () => {
    expect(canTransition('APPROVED', 'APPROVED')).toBe(true);
  });

  it('derives lifecycle from the legacy status pair', () => {
    expect(deriveLifecycleFromLegacy({ approvalStatus: 'PENDING' })).toBe('REQUESTED');
    expect(deriveLifecycleFromLegacy({ approvalStatus: 'NEED_INFO' })).toBe('NEED_INFO');
    expect(
      deriveLifecycleFromLegacy({
        approvalStatus: 'APPROVED',
        physicalStatus: 'WAITING_RETURN',
      }),
    ).toBe('APPROVED');
    expect(
      deriveLifecycleFromLegacy({
        approvalStatus: 'APPROVED',
        physicalStatus: 'RETURNED',
      }),
    ).toBe('RECEIVED');
    expect(
      deriveLifecycleFromLegacy({
        approvalStatus: 'APPROVED',
        physicalStatus: 'RETURNED',
        inventoryFate: 'REWORK',
      }),
    ).toBe('REWORKING');
    expect(deriveLifecycleFromLegacy({ approvalStatus: 'REJECTED' })).toBe('REJECTED');
  });

  it('dual-writes the legacy fields from the new state', () => {
    expect(legacyFieldsFromLifecycle('IN_TRANSIT')).toEqual({
      approvalStatus: 'APPROVED',
      physicalStatus: 'WAITING_RETURN',
    });
    expect(legacyFieldsFromLifecycle('RECEIVED').physicalStatus).toBe('RETURNED');
    expect(applyLifecycle('APPROVED', 'RECEIVED').lifecycleState).toBe('RECEIVED');
  });

  it('blocks new credit-note and refund resolutions while defaulting to replacement', () => {
    expect(approvedReturnResolution('REPAIR')).toBe('REPAIR');
    expect(approvedReturnResolution('REPLACEMENT')).toBe('REPLACEMENT');
    expect(approvedReturnResolution(undefined)).toBe('REPLACEMENT');
    expect(() => approvedReturnResolution('CREDIT_NOTE')).toThrow(BadRequestException);
    expect(() => approvedReturnResolution('REFUND')).toThrow(BadRequestException);
  });
});
