import {
  allOutboundPiecesReady,
  caseLifecyclePatch,
  deriveCaseLifecycle,
  summarizePieces,
} from './return-case-aggregate';

describe('return case aggregate', () => {
  it('counts pieces and decisions without using quantity math', () => {
    const summary = summarizePieces([
      { state: 'IN_PROGRESS', decision: 'REPAIR', outboundEligible: true },
      { state: 'IN_PROGRESS', decision: 'REPLACEMENT', outboundEligible: true },
      { state: 'RECOVERED', decision: 'SCRAP_RECOVERY', outboundEligible: false },
    ]);
    expect(summary.total).toBe(3);
    expect(summary.repair).toBe(1);
    expect(summary.replacement).toBe(1);
    expect(summary.scrapRecovery).toBe(1);
    expect(summary.outboundEligible).toBe(2);
    expect(summary.recovered).toBe(1);
  });

  it('does not let one production order overwrite the case', () => {
    expect(
      deriveCaseLifecycle({
        parentState: 'RECEIVED',
        approvalStatus: 'APPROVED',
        pieces: [
          { state: 'IN_PROGRESS', decision: 'REPAIR', outboundEligible: true },
          { state: 'RECEIVED', decision: null, outboundEligible: true },
          { state: 'RECOVERED', decision: 'SCRAP_RECOVERY', outboundEligible: false },
        ],
      }),
    ).toBe('REWORKING');
  });

  it('becomes ready only when every outbound piece is ready', () => {
    const mixed = [
      { state: 'READY_TO_RETURN', decision: 'REPAIR', outboundEligible: true },
      { state: 'IN_PROGRESS', decision: 'REPLACEMENT', outboundEligible: true },
      { state: 'RECOVERED', decision: 'SCRAP_RECOVERY', outboundEligible: false },
    ];
    expect(allOutboundPiecesReady(mixed)).toBe(false);
    expect(deriveCaseLifecycle({ parentState: 'REWORKING', pieces: mixed })).toBe('REWORKING');

    const ready = [
      { state: 'READY_TO_RETURN', decision: 'REPAIR', outboundEligible: true },
      { state: 'READY_TO_RETURN', decision: 'REPLACEMENT', outboundEligible: true },
      { state: 'RECOVERED', decision: 'SCRAP_RECOVERY', outboundEligible: false },
    ];
    expect(allOutboundPiecesReady(ready)).toBe(true);
    expect(deriveCaseLifecycle({ parentState: 'REWORKING', pieces: ready })).toBe('READY_TO_RETURN');
  });

  it('completes a scrap-only case when recovery finishes', () => {
    expect(
      deriveCaseLifecycle({
        parentState: 'REWORKING',
        pieces: [{ state: 'RECOVERED', decision: 'SCRAP_RECOVERY', outboundEligible: false }],
      }),
    ).toBe('COMPLETED');
  });

  it('keeps inbound states until pieces are received', () => {
    expect(
      deriveCaseLifecycle({
        parentState: 'IN_TRANSIT',
        approvalStatus: 'APPROVED',
        pieces: [
          { state: 'AWAITING_RECEIPT' },
          { state: 'AWAITING_RECEIPT' },
        ],
      }),
    ).toBe('IN_TRANSIT');
    expect(
      caseLifecyclePatch({
        parentState: 'APPROVED',
        approvalStatus: 'APPROVED',
        pieces: [{ state: 'RECEIVED' }],
      }).physicalStatus,
    ).toBe('RETURNED');
  });
});
