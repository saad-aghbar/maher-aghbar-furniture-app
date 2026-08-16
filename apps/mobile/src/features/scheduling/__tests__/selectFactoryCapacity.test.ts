import type { CapacityResponse, CapacityRow } from '@/api/modules/scheduling';
import {
  minutesToHoursLabel,
  selectBottleneckStages,
  selectCapacityQueryParams,
  selectCapacityState,
  capacityStateLabelKey,
  selectFactoryCapacityCards,
  selectFactoryLoadByDay,
  selectFactoryLoadPercent,
  selectWeekCapacityCells,
  shiftCapacityAnchor,
  sortCapacityCardsForDisplay,
} from '../selectFactoryCapacity';

function row(overrides: Partial<CapacityRow> & Pick<CapacityRow, 'code' | 'nameEn'>): CapacityRow {
  return {
    departmentId: overrides.stageDefinitionId ?? overrides.departmentId ?? overrides.code,
    stageDefinitionId: overrides.stageDefinitionId ?? overrides.code,
    nameAr: null,
    nameHe: null,
    bookedMinutes: overrides.allocatedMinutes ?? overrides.bookedMinutes ?? 0,
    capacityMinutes: overrides.availableMinutes ?? overrides.capacityMinutes ?? 0,
    allocatedMinutes: overrides.allocatedMinutes ?? 0,
    availableMinutes: overrides.availableMinutes ?? 0,
    remainingMinutes: overrides.remainingMinutes ?? 0,
    eligibleWorkerCount: 0,
    ...overrides,
  };
}

describe('selectFactoryCapacity', () => {
  it('renders an arbitrary extra stage from the payload without code changes', () => {
    const cards = selectFactoryCapacityCards(
      [
        row({
          code: 'CARPENTRY',
          nameEn: 'Carpentry',
          eligibleWorkerCount: 4,
          availableMinutes: 1920,
          allocatedMinutes: 1440,
          remainingMinutes: 480,
        }),
        row({
          code: 'FINISHING',
          nameEn: 'Finishing',
          eligibleWorkerCount: 1,
          availableMinutes: 420,
          allocatedMinutes: 60,
          remainingMinutes: 360,
        }),
      ],
      'en',
      true,
    );
    expect(cards.map((c) => c.code)).toEqual(['CARPENTRY', 'FINISHING']);
    expect(cards[1]!.name).toBe('Finishing');
  });

  it('Carpentry 4 / 32h / 24h / 8h → 75% remaining 8h', () => {
    const [card] = selectFactoryCapacityCards(
      [
        row({
          code: 'CARPENTRY',
          nameEn: 'Carpentry',
          eligibleWorkerCount: 4,
          availableMinutes: 32 * 60,
          allocatedMinutes: 24 * 60,
          remainingMinutes: 8 * 60,
        }),
      ],
      'en',
      true,
    );
    expect(card!.utilizationPercent).toBe(75);
    expect(card!.remainingHours).toBe('8');
    expect(card!.allocatedHours).toBe('24');
    expect(card!.availableHours).toBe('32');
    expect(card!.state).toBe('moderate');
  });

  it('Painting eligibleWorkerCount 0 is blocked, not 0h available', () => {
    const [card] = selectFactoryCapacityCards(
      [
        row({
          code: 'PAINTING',
          nameEn: 'Painting',
          eligibleWorkerCount: 0,
          availableMinutes: 0,
          allocatedMinutes: 0,
          remainingMinutes: 0,
        }),
      ],
      'en',
      true,
    );
    expect(card!.state).toBe('noEligibleWorkers');
    expect(card!.utilizationPercent).toBe(0);
  });

  it('A: 14h available / 10h allocated → 4h remaining, not Full', () => {
    const [card] = selectFactoryCapacityCards(
      [
        row({
          code: 'FOAM',
          nameEn: 'Foam preparation',
          eligibleWorkerCount: 2,
          availableMinutes: 840,
          allocatedMinutes: 600,
          remainingMinutes: 240,
        }),
      ],
      'en',
      true,
    );
    expect(card!.allocatedHours).toBe('10');
    expect(card!.availableHours).toBe('14');
    expect(card!.remainingHours).toBe('4');
    expect(card!.state).toBe('moderate');
    expect(card!.utilizationPercent).toBe(71);
  });

  it('B: 14h / 14h is Full with 0 remaining and is not a conflict by itself', () => {
    const [card] = selectFactoryCapacityCards(
      [
        row({
          code: 'FOAM',
          nameEn: 'Foam preparation',
          eligibleWorkerCount: 2,
          availableMinutes: 840,
          allocatedMinutes: 840,
          remainingMinutes: 0,
        }),
      ],
      'en',
      true,
    );
    expect(card!.state).toBe('full');
    expect(card!.remainingHours).toBe('0');
    expect(card!.utilizationPercent).toBe(100);
  });

  it('F: 19h allocated / 14h available stays Full and does not invent OVER_CAPACITY', () => {
    const [card] = selectFactoryCapacityCards(
      [
        row({
          code: 'FOAM',
          nameEn: 'Foam preparation',
          eligibleWorkerCount: 2,
          availableMinutes: 840,
          allocatedMinutes: 1140,
          remainingMinutes: 0,
        }),
      ],
      'en',
      true,
    );
    expect(card!.state).toBe('full');
    expect(card!.allocatedHours).toBe('19');
    expect(card!.availableHours).toBe('14');
    expect(card!.remainingHours).toBe('0');
    expect(card!.utilizationPercent).toBe(100);
    expect(card!.state).not.toBe('overCapacity' as never);
  });

  it('Upholstery remaining 0 is Full', () => {
    const [card] = selectFactoryCapacityCards(
      [
        row({
          code: 'UPHOLSTERY',
          nameEn: 'Upholstery',
          eligibleWorkerCount: 2,
          availableMinutes: 840,
          allocatedMinutes: 840,
          remainingMinutes: 0,
        }),
      ],
      'en',
      true,
    );
    expect(card!.state).toBe('full');
  });

  it('isWorking false is Closed, not 0%', () => {
    expect(
      selectCapacityState({
        isWorking: false,
        eligibleWorkerCount: 2,
        availableMinutes: 0,
        remainingMinutes: 0,
        allocatedMinutes: 0,
      }),
    ).toBe('closed');
    const [card] = selectFactoryCapacityCards(
      [
        row({
          code: 'CARPENTRY',
          nameEn: 'Carpentry',
          eligibleWorkerCount: 2,
          availableMinutes: 0,
          allocatedMinutes: 0,
          remainingMinutes: 0,
        }),
      ],
      'en',
      false,
    );
    expect(card!.state).toBe('closed');
    expect(selectFactoryLoadPercent([card!], false)).toBeNull();
  });

  it('does not invent zeros from an error — caller must keep error UI', () => {
    expect(selectFactoryCapacityCards(undefined, 'en', true)).toEqual([]);
  });

  it('date prev/next changes query from/to', () => {
    expect(shiftCapacityAnchor('day', '2026-08-10', -1)).toBe('2026-08-09');
    expect(shiftCapacityAnchor('day', '2026-08-10', 1)).toBe('2026-08-11');
    expect(selectCapacityQueryParams('day', '2026-08-10')).toEqual({
      from: '2026-08-10',
      to: '2026-08-10',
      granularity: 'day',
      includeWorkers: true,
    });
  });

  it('week mode uses granularity=day over the week range', () => {
    const params = selectCapacityQueryParams('week', '2026-08-12');
    expect(params.granularity).toBe('day');
    expect(params.from).toBe('2026-08-09');
    expect(params.to).toBe('2026-08-15');
    expect(params.includeWorkers).toBeUndefined();
  });

  it('maps each byDay row to factory load % for the month board', () => {
    const response: CapacityResponse = {
      data: [],
      byDay: [
        {
          date: '2026-08-30',
          isWorking: true,
          data: [
            row({
              code: 'FOAM',
              nameEn: 'Foam preparation',
              eligibleWorkerCount: 2,
              availableMinutes: 840,
              allocatedMinutes: 240,
              remainingMinutes: 600,
            }),
            row({
              code: 'CARPENTRY',
              nameEn: 'Carpentry',
              eligibleWorkerCount: 2,
              availableMinutes: 840,
              allocatedMinutes: 0,
              remainingMinutes: 840,
            }),
          ],
        },
        {
          date: '2026-08-28',
          isWorking: false,
          data: [
            row({
              code: 'FOAM',
              nameEn: 'Foam preparation',
              eligibleWorkerCount: 2,
              availableMinutes: 0,
              allocatedMinutes: 0,
              remainingMinutes: 0,
            }),
          ],
        },
      ],
    };
    const byDay = selectFactoryLoadByDay(response, 'en');
    expect(byDay['2026-08-30']).toBe(14);
    expect(byDay['2026-08-28']).toBeNull();
  });

  it('week cells mark closed days without a percent', () => {
    const response: CapacityResponse = {
      data: [],
      byDay: [
        {
          date: '2026-08-14',
          isWorking: false,
          data: [
            row({
              code: 'CARPENTRY',
              nameEn: 'Carpentry',
              stageDefinitionId: 'CARPENTRY',
              eligibleWorkerCount: 2,
              availableMinutes: 0,
              allocatedMinutes: 0,
              remainingMinutes: 0,
            }),
          ],
        },
      ],
    };
    const cells = selectWeekCapacityCells(response.byDay, 'CARPENTRY');
    expect(cells[0]!.isWorking).toBe(false);
    expect(cells[0]!.percent).toBeNull();
    expect(cells[0]!.state).toBe('closed');
  });

  it('formats hours from backend minutes only', () => {
    expect(minutesToHoursLabel(480)).toBe('8');
    expect(minutesToHoursLabel(90)).toBe('1.5');
  });

  it('passes ineligible and unassigned minutes through without recomputing eligibility', () => {
    const [card] = selectFactoryCapacityCards(
      [
        row({
          code: 'DELIVERY',
          nameEn: 'Delivery',
          eligibleWorkerCount: 2,
          availableMinutes: 1680,
          allocatedMinutes: 529,
          remainingMinutes: 1151,
          workers: [
            {
              employeeId: 'omar',
              firstName: 'Omar',
              lastName: 'Hijazi',
              eligible: true,
              allocatedMinutes: 157,
              availableMinutes: 840,
              remainingMinutes: 683,
            },
            {
              employeeId: 'yousef',
              firstName: 'Yousef',
              lastName: 'Haddad',
              eligible: true,
              allocatedMinutes: 42,
              availableMinutes: 840,
              remainingMinutes: 798,
            },
          ],
          ineligibleWorkers: [
            {
              employeeId: 'basel',
              firstName: 'Basel',
              lastName: 'Smadi',
              eligible: false,
              allocatedMinutes: 288,
              availableMinutes: 0,
              remainingMinutes: 0,
            },
            {
              employeeId: 'anas',
              firstName: 'Anas',
              lastName: 'Freijat',
              eligible: false,
              allocatedMinutes: 42,
              availableMinutes: 0,
              remainingMinutes: 0,
            },
          ],
          unassignedAllocatedMinutes: 0,
        }),
      ],
      'en',
      true,
    );
    expect(card!.availableHours).toBe('28');
    expect(card!.allocatedHours).toBe('8.8');
    expect(card!.remainingHours).toBe('19.2');
    expect(card!.workers.map((w) => w.name)).toEqual(['Omar Hijazi', 'Yousef Haddad']);
    expect(card!.workers.every((w) => w.eligible)).toBe(true);
    expect(card!.ineligibleWorkers).toEqual([
      expect.objectContaining({
        name: 'Basel Smadi',
        eligible: false,
        allocatedHours: '4.8',
        availableHours: '0',
        full: false,
      }),
      expect.objectContaining({
        name: 'Anas Freijat',
        eligible: false,
        allocatedHours: '0.7',
        availableHours: '0',
      }),
    ]);
    expect(card!.unassignedAllocatedMinutes).toBe(0);
    expect(card!.unassignedHours).toBe('0');
  });

  it('defaults missing ineligible and unassigned fields to empty', () => {
    const [card] = selectFactoryCapacityCards(
      [
        row({
          code: 'FOAM',
          nameEn: 'Foam preparation',
          eligibleWorkerCount: 2,
          availableMinutes: 840,
          allocatedMinutes: 240,
          remainingMinutes: 600,
        }),
      ],
      'en',
      true,
    );
    expect(card!.ineligibleWorkers).toEqual([]);
    expect(card!.unassignedAllocatedMinutes).toBe(0);
  });

  it('keeps acronym stage codes instead of title case', () => {
    const [card] = selectFactoryCapacityCards(
      [
        row({
          code: 'CNC',
          nameEn: 'Cnc',
          eligibleWorkerCount: 1,
          availableMinutes: 420,
          allocatedMinutes: 0,
          remainingMinutes: 420,
        }),
      ],
      'en',
      true,
    );
    expect(card!.name).toBe('CNC');
  });
});

describe('capacity attention', () => {
  it('finds a bottleneck when overall load is moderate and one stage is full', () => {
    const cards = selectFactoryCapacityCards(
      [
        row({
          code: 'CARPENTRY',
          nameEn: 'Carpentry',
          eligibleWorkerCount: 4,
          availableMinutes: 1800,
          allocatedMinutes: 313,
          remainingMinutes: 1487,
        }),
        row({
          code: 'INSPECTION',
          nameEn: 'Inspection',
          eligibleWorkerCount: 1,
          availableMinutes: 420,
          allocatedMinutes: 420,
          remainingMinutes: 0,
        }),
      ],
      'en',
      true,
    );
    expect(selectFactoryLoadPercent(cards, true)).toBe(33);
    const bottlenecks = selectBottleneckStages(cards);
    expect(bottlenecks).toHaveLength(1);
    expect(bottlenecks[0]).toMatchObject({ name: 'Inspection', state: 'full' });
  });

  it('returns every tight stage, not only the first', () => {
    const cards = selectFactoryCapacityCards(
      [
        row({
          code: 'CARPENTRY',
          nameEn: 'Carpentry',
          eligibleWorkerCount: 2,
          availableMinutes: 840,
          allocatedMinutes: 200,
          remainingMinutes: 640,
        }),
        row({
          code: 'INSPECTION',
          nameEn: 'Inspection',
          eligibleWorkerCount: 1,
          availableMinutes: 420,
          allocatedMinutes: 420,
          remainingMinutes: 0,
        }),
        row({
          code: 'ASSEMBLY',
          nameEn: 'Assembly',
          eligibleWorkerCount: 1,
          availableMinutes: 420,
          allocatedMinutes: 380,
          remainingMinutes: 40,
        }),
        row({
          code: 'PAINTING',
          nameEn: 'Painting',
          eligibleWorkerCount: 0,
          availableMinutes: 0,
          allocatedMinutes: 0,
          remainingMinutes: 0,
        }),
      ],
      'en',
      true,
    );
    expect(selectBottleneckStages(cards).map((card) => card.name)).toEqual([
      'Painting',
      'Inspection',
      'Assembly',
    ]);
  });

  it('sorts blocked before available for display', () => {
    const cards = selectFactoryCapacityCards(
      [
        row({
          code: 'CARPENTRY',
          nameEn: 'Carpentry',
          eligibleWorkerCount: 2,
          availableMinutes: 840,
          allocatedMinutes: 60,
          remainingMinutes: 780,
        }),
        row({
          code: 'PAINTING',
          nameEn: 'Painting',
          eligibleWorkerCount: 0,
          availableMinutes: 0,
          allocatedMinutes: 0,
          remainingMinutes: 0,
        }),
      ],
      'en',
      true,
    );
    expect(sortCapacityCardsForDisplay(cards).map((c) => c.code)).toEqual([
      'PAINTING',
      'CARPENTRY',
    ]);
  });

  it('maps capacity states to i18n keys instead of raw enums', () => {
    const states = [
      'available',
      'moderate',
      'nearCapacity',
      'full',
      'unavailable',
      'noEligibleWorkers',
      'closed',
    ] as const;
    for (const state of states) {
      const key = capacityStateLabelKey(state);
      expect(key.startsWith('mobile.adminScheduling.capacity.')).toBe(true);
      expect(key).not.toBe(state);
      expect(key).not.toMatch(/NEAR_CAPACITY|AVAILABLE|FULL/);
    }
  });
});
