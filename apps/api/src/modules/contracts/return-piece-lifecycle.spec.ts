import {
  assertPieceTransition,
  canTransitionPiece,
  dealerPieceLabel,
  decisionAllowed,
  isOutboundEligible,
  nextStateAfterDecision,
  outboundEligibleForDecision,
} from './return-piece-lifecycle';

describe('return piece lifecycle', () => {
  it('allows the physical journey and blocks jumps', () => {
    expect(canTransitionPiece('AWAITING_RECEIPT', 'RECEIVED')).toBe(true);
    expect(canTransitionPiece('RECEIVED', 'DECIDED')).toBe(true);
    expect(canTransitionPiece('DECIDED', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionPiece('DECIDED', 'READY_TO_RETURN')).toBe(true);
    expect(canTransitionPiece('IN_PROGRESS', 'READY_TO_RETURN')).toBe(true);
    expect(canTransitionPiece('READY_TO_RETURN', 'CANCELLED')).toBe(true);
    expect(canTransitionPiece('IN_PROGRESS', 'RECOVERED')).toBe(true);
    expect(canTransitionPiece('READY_TO_RETURN', 'RETURNING')).toBe(true);
    expect(canTransitionPiece('RETURNING', 'RETURNED')).toBe(true);
    expect(canTransitionPiece('AWAITING_RECEIPT', 'DECIDED')).toBe(false);
    expect(canTransitionPiece('RECOVERED', 'READY_TO_RETURN')).toBe(false);
    expect(() => assertPieceTransition('RECEIVED', 'READY_TO_RETURN')).toThrow(
      /Cannot move a return piece/,
    );
  });

  it('only allows a factory decision after receive', () => {
    expect(decisionAllowed('AWAITING_RECEIPT')).toBe(false);
    expect(decisionAllowed('RECEIVED')).toBe(true);
    expect(decisionAllowed('DECIDED')).toBe(false);
    expect(nextStateAfterDecision('REPAIR')).toBe('DECIDED');
  });

  it('marks scrap recovery as never outbound', () => {
    expect(outboundEligibleForDecision('REPAIR')).toBe(true);
    expect(outboundEligibleForDecision('REPLACEMENT')).toBe(true);
    expect(outboundEligibleForDecision('SCRAP_RECOVERY')).toBe(false);
    expect(isOutboundEligible({ decision: 'SCRAP_RECOVERY', outboundEligible: true })).toBe(false);
    expect(isOutboundEligible({ decision: 'REPAIR', outboundEligible: true })).toBe(true);
    expect(isOutboundEligible({ decision: 'REPAIR', outboundEligible: false })).toBe(false);
  });

  it('maps dealer-safe piece labels', () => {
    expect(dealerPieceLabel('REPAIR', 'IN_PROGRESS')).toBe('repairing');
    expect(dealerPieceLabel('REPLACEMENT', 'IN_PROGRESS')).toBe('replacing');
    expect(dealerPieceLabel('SCRAP_RECOVERY', 'IN_PROGRESS')).toBe('recovering');
    expect(dealerPieceLabel('SCRAP_RECOVERY', 'RECOVERED')).toBe('resolved');
    expect(dealerPieceLabel('REPAIR', 'READY_TO_RETURN')).toBe('ready');
  });
});
