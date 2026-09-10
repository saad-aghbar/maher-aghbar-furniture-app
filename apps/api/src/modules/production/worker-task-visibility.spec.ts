import { TaskStatus } from '@maher/database';
import {
  workerAssignedRemainingOrdersWhere,
  workerAssignedRemainingTaskWhere,
  workerFloorOpenClauses,
} from './worker-task-visibility';

describe('worker assigned remaining orders', () => {
  it('lists remaining work by assignedEmployeeId only', () => {
    expect(workerAssignedRemainingTaskWhere('worker-a')).toEqual({
      assignedEmployeeId: 'worker-a',
      status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
    });
  });

  it('does not hide assigned orders behind factory release', () => {
    const where = workerAssignedRemainingOrdersWhere('worker-a');
    expect(where).toEqual({
      archivedAt: null,
      status: { not: 'CANCELLED' },
      tasks: { some: workerAssignedRemainingTaskWhere('worker-a') },
    });
    expect(JSON.stringify(where)).not.toContain('releasedToFactoryAt');
    expect(JSON.stringify(where)).not.toContain('actualStartDate');
  });

  it('keeps Home / open task rows on the floor gate', () => {
    expect(JSON.stringify(workerFloorOpenClauses())).toContain('releasedToFactoryAt');
  });
});
