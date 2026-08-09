import {
  computeDealerEditPolicy,
  DEALER_EDIT_WINDOW_MS,
  detectsFabricMutation,
  isFabricInProduction,
  preserveFabricOnItems,
  resolveSubmissionAnchor,
} from '../dealer-edit-policy';

describe('dealer-edit-policy', () => {
  const submittedAt = new Date('2026-08-01T12:00:00.000Z');

  it('keeps drafts editable regardless of age', () => {
    const serverNow = new Date('2026-09-01T12:00:00.000Z');
    const policy = computeDealerEditPolicy({
      status: 'DRAFT',
      submittedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      serverNow,
      fabricInProduction: false,
      isDealer: true,
    });
    expect(policy.canEdit).toBe(true);
    expect(policy.lockReasons).toEqual([]);
  });

  it('allows edits within 3 days of submission (server clock)', () => {
    const serverNow = new Date(submittedAt.getTime() + 2 * 24 * 60 * 60 * 1000);
    const policy = computeDealerEditPolicy({
      status: 'SUBMITTED',
      submittedAt,
      createdAt: submittedAt,
      serverNow,
      fabricInProduction: false,
      isDealer: true,
    });
    expect(policy.canEdit).toBe(true);
    expect(policy.remainingMs).toBeGreaterThan(0);
    expect(policy.editWindowEndsAt).toBe(
      new Date(submittedAt.getTime() + DEALER_EDIT_WINDOW_MS).toISOString(),
    );
  });

  it('locks the order after exactly 3 days (boundary)', () => {
    const serverNow = new Date(submittedAt.getTime() + DEALER_EDIT_WINDOW_MS + 1);
    const policy = computeDealerEditPolicy({
      status: 'SUBMITTED',
      submittedAt,
      createdAt: submittedAt,
      serverNow,
      fabricInProduction: false,
      isDealer: true,
    });
    expect(policy.canEdit).toBe(false);
    expect(policy.remainingMs).toBe(0);
    expect(policy.lockReasons.some((r) => r.code === 'ORDER_LOCKED')).toBe(true);
  });

  it('does not trust a client-skewed “now” — caller must inject serverNow', () => {
    const earlyClient = new Date(submittedAt.getTime() + 1000);
    const lateServer = new Date(submittedAt.getTime() + DEALER_EDIT_WINDOW_MS + 60_000);
    const policy = computeDealerEditPolicy({
      status: 'SUBMITTED',
      submittedAt,
      createdAt: submittedAt,
      serverNow: lateServer,
      fabricInProduction: false,
      isDealer: true,
    });
    expect(policy.canEdit).toBe(false);
    expect(policy.serverNow).toBe(lateServer.toISOString());
    expect(policy.serverNow).not.toBe(earlyClient.toISOString());
  });

  it('locks fabric fields when upholstery has started', () => {
    expect(isFabricInProduction({ currentStageCode: 'UPHOLSTERY', progressPercent: 10 })).toBe(
      true,
    );
    expect(isFabricInProduction({ currentStageCode: 'MATERIAL_PREP', progressPercent: 10 })).toBe(
      false,
    );
    expect(isFabricInProduction({ currentStageCode: 'CARPENTRY', progressPercent: 45 })).toBe(true);

    const policy = computeDealerEditPolicy({
      status: 'SUBMITTED',
      submittedAt,
      createdAt: submittedAt,
      serverNow: new Date(submittedAt.getTime() + 60_000),
      fabricInProduction: true,
      isDealer: true,
    });
    expect(policy.canEdit).toBe(true);
    expect(policy.fabricLocked).toBe(true);
    expect(policy.lockedFields).toContain('fabric');
  });

  it('allows admin edits on any status without the 3-day window', () => {
    const serverNow = new Date(submittedAt.getTime() + DEALER_EDIT_WINDOW_MS + 60_000);
    const policy = computeDealerEditPolicy({
      status: 'QUOTED',
      submittedAt,
      createdAt: submittedAt,
      serverNow,
      fabricInProduction: true,
      isDealer: false,
    });
    expect(policy.canEdit).toBe(true);
    expect(policy.fabricLocked).toBe(false);
    expect(policy.editWindowEndsAt).toBeNull();
    expect(policy.lockReasons).toEqual([]);
  });

  it('detects fabric mutations from modified client payloads', () => {
    const existing = [{ fabricType: 'Linen', fabricColor: 'Beige' }];
    expect(
      detectsFabricMutation(existing, [{ fabric: 'Velvet', color: 'Beige' }]),
    ).toBe(true);
    expect(
      detectsFabricMutation(existing, [{ fabric: 'Linen', color: 'Beige' }]),
    ).toBe(false);
    expect(detectsFabricMutation(existing, [{ fabric: 'Linen', color: 'Beige' }])).toBe(false);
  });

  it('preserves fabric when stripping locked fields from items', () => {
    const existing = [{ fabricType: 'Linen', fabricColor: 'Beige', fabricCode: 'L1' }];
    const incoming = [
      {
        fabric: 'Hacked',
        color: 'Red',
        notes: 'Keep notes',
        width: 100,
      },
    ];
    const preserved = preserveFabricOnItems(existing, incoming);
    expect(preserved[0]!.fabric).toBe('Linen');
    expect(preserved[0]!.color).toBe('Beige');
    expect(preserved[0]!.notes).toBe('Keep notes');
    expect(preserved[0]!.width).toBe(100);
  });

  it('anchors the window on submittedAt when present', () => {
    const createdAt = new Date('2026-07-01T00:00:00.000Z');
    const anchor = resolveSubmissionAnchor({
      status: 'SUBMITTED',
      submittedAt,
      createdAt,
    });
    expect(anchor.toISOString()).toBe(submittedAt.toISOString());
  });
});
