import {
  allOpenTasks,
  formatEstimatedDuration,
  hasOpenTasks,
  isWorkerHomeEmpty,
  selectCurrentTask,
  selectTodayProgress,
  selectUpcomingTasks,
} from '../selectWorkerHome';
import { workerHomeEmptyFixture, workerHomeSuccessFixture } from '../fixtures';
import type { WorkerHomePayload } from '../api';

describe('selectWorkerHome', () => {
  it('detects empty home', () => {
    expect(isWorkerHomeEmpty(workerHomeEmptyFixture)).toBe(true);
    expect(isWorkerHomeEmpty(workerHomeSuccessFixture)).toBe(false);
  });

  it('detects open tasks', () => {
    expect(hasOpenTasks(workerHomeSuccessFixture)).toBe(true);
    expect(hasOpenTasks(workerHomeEmptyFixture)).toBe(false);
  });

  it('merges urgent into open list without duplicating', () => {
    const open = allOpenTasks(workerHomeSuccessFixture);
    const ids = open.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    if (workerHomeSuccessFixture.urgentTask) {
      expect(ids).toContain(workerHomeSuccessFixture.urgentTask.id);
    }
  });

  it('picks current task and upcoming queue', () => {
    const current = selectCurrentTask(workerHomeSuccessFixture);
    expect(current?.id).toBe(workerHomeSuccessFixture.urgentTask?.id);
    const upcoming = selectUpcomingTasks(workerHomeSuccessFixture);
    expect(upcoming.every((t) => t.id !== current?.id)).toBe(true);
  });

  it('prefers in-progress over urgent for current task', () => {
    const urgentReady = {
      ...workerHomeSuccessFixture.urgentTask!,
      status: 'READY',
    };
    const inProgress = {
      ...workerHomeSuccessFixture.todaysTasks[0]!,
      id: 'in-progress-1',
      status: 'IN_PROGRESS',
      priority: 'NORMAL',
    };
    const payload: WorkerHomePayload = {
      ...workerHomeSuccessFixture,
      urgentTask: urgentReady,
      todaysTasks: [inProgress, ...workerHomeSuccessFixture.todaysTasks.slice(1)],
    };
    expect(selectCurrentTask(payload)?.id).toBe('in-progress-1');
  });

  it('computes today progress breakdown without progressPercent', () => {
    const progress = selectTodayProgress(workerHomeSuccessFixture);
    expect(progress.completed).toBe(3);
    expect(progress.inProgress).toBe(1);
    expect(progress.remaining).toBe(2);
    expect(progress.totalToday).toBe(6);
    expect(progress.percentCompleted).toBe(50);
    expect(JSON.stringify(progress)).not.toContain('progressPercent');
  });

  it('formats estimated duration', () => {
    expect(formatEstimatedDuration(90, { hour: 'h', minute: 'm' })).toBe('1h 30m');
    expect(formatEstimatedDuration(60, { hour: 'h', minute: 'm' })).toBe('1h');
    expect(formatEstimatedDuration(45, { hour: 'h', minute: 'm' })).toBe('45m');
    expect(formatEstimatedDuration(null, { hour: 'h', minute: 'm' })).toBeNull();
  });

  it('success fixture includes estimated minutes and no progress leak', () => {
    expect(workerHomeSuccessFixture.urgentTask?.estimatedMinutes).toBe(90);
    expect(workerHomeSuccessFixture.urgentTask?.priority).toBe('URGENT');
    expect(JSON.stringify(workerHomeSuccessFixture)).not.toContain('progressPercent');
  });
});
