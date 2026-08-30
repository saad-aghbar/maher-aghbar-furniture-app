import {
  canConsumeQty,
  custodyFilterForKit,
  incomingWorkStatus,
  kitFeedsConsumerNode,
  remainingReceivable,
} from '../domain/wip-handoff';

describe('kitFeedsConsumerNode', () => {
  const edges = [
    { fromSnapshotNodeId: 'n-carp', toSnapshotNodeId: 'n-assy' },
    { fromSnapshotNodeId: 'n-prep', toSnapshotNodeId: 'n-carp' },
  ];

  it('matches when nextSnapshotNodeIds includes consumer', () => {
    expect(
      kitFeedsConsumerNode({
        nextSnapshotNodeIds: ['n-assy'],
        snapshotNodeId: 'n-carp',
        consumerSnapshotNodeId: 'n-assy',
        edges,
      }),
    ).toBe(true);
  });

  it('rejects empty next-hops without a graph edge (Material Prep false gate)', () => {
    expect(
      kitFeedsConsumerNode({
        nextSnapshotNodeIds: [],
        snapshotNodeId: 'n-carp',
        consumerSnapshotNodeId: 'n-prep',
        edges,
      }),
    ).toBe(false);
  });

  it('uses DAG edge when next-hops empty', () => {
    expect(
      kitFeedsConsumerNode({
        nextSnapshotNodeIds: [],
        snapshotNodeId: 'n-carp',
        consumerSnapshotNodeId: 'n-assy',
        edges,
      }),
    ).toBe(true);
  });

  it('never matches empty next-hops with missing producer snapshot', () => {
    expect(
      kitFeedsConsumerNode({
        nextSnapshotNodeIds: [],
        snapshotNodeId: null,
        consumerSnapshotNodeId: 'n-assy',
        edges,
      }),
    ).toBe(false);
  });

  it('Material Prep consumer with no DAG edge does not feed from Carpentry kit', () => {
    expect(
      kitFeedsConsumerNode({
        nextSnapshotNodeIds: [],
        snapshotNodeId: 'n-carp',
        consumerSnapshotNodeId: 'n-mat-prep',
        edges: [
          { fromSnapshotNodeId: 'n-mat-prep', toSnapshotNodeId: 'n-carp' },
          { fromSnapshotNodeId: 'n-carp', toSnapshotNodeId: 'n-assy' },
        ],
      }),
    ).toBe(false);
  });

  it('Assembly requires Carpentry via edge when next-hops empty', () => {
    expect(
      kitFeedsConsumerNode({
        nextSnapshotNodeIds: [],
        snapshotNodeId: 'n-carp',
        consumerSnapshotNodeId: 'n-assy',
        edges: [{ fromSnapshotNodeId: 'n-carp', toSnapshotNodeId: 'n-assy' }],
      }),
    ).toBe(true);
  });
});

describe('receive / consume math', () => {
  it('remainingReceivable clamps at zero', () => {
    expect(remainingReceivable(10, 4)).toBe(6);
    expect(remainingReceivable(3, 3)).toBe(0);
    expect(remainingReceivable(2, 5)).toBe(0);
  });

  it('rejects over-receive and allows partial then remainder', () => {
    expect(remainingReceivable(10, 0)).toBe(10);
    expect(remainingReceivable(10, 4)).toBe(6);
    expect(remainingReceivable(10, 10)).toBe(0);
    expect(remainingReceivable(10, 4 + 6)).toBe(0);
  });

  it('consume must stay within received', () => {
    expect(
      canConsumeQty({
        receivedAtDestination: 5,
        alreadyConsumedAtDestination: 2,
        consumeQty: 3,
      }),
    ).toBe(true);
    expect(
      canConsumeQty({
        receivedAtDestination: 5,
        alreadyConsumedAtDestination: 2,
        consumeQty: 4,
      }),
    ).toBe(false);
  });
});

describe('incomingWorkStatus', () => {
  it('maps qty coverage to human status keys', () => {
    expect(incomingWorkStatus({ produced: 0, received: 0, expected: 2 })).toBe(
      'WAITING_PRODUCTION',
    );
    expect(incomingWorkStatus({ produced: 2, received: 0, expected: 2 })).toBe(
      'READY_TO_COLLECT',
    );
    expect(incomingWorkStatus({ produced: 2, received: 1, expected: 2 })).toBe(
      'PARTIALLY_RECEIVED',
    );
    expect(incomingWorkStatus({ produced: 2, received: 2, expected: 2 })).toBe(
      'RECEIVED',
    );
  });
});

describe('custodyFilterForKit', () => {
  it('buckets READY as waiting pickup', () => {
    expect(custodyFilterForKit({ status: 'READY', handoffCount: 0 })).toBe(
      'WAITING_PICKUP',
    );
  });

  it('buckets CLAIMED / handoffs as received', () => {
    expect(custodyFilterForKit({ status: 'CLAIMED', handoffCount: 1 })).toBe(
      'RECEIVED',
    );
  });
});
