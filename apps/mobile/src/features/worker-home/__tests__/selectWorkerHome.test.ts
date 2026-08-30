import {
  allOpenTasks,
  formatEstimatedDuration,
  hasOpenTasks,
  isWorkerHomeEmpty,
  mapTaskListItemToWorkerHomeTask,
  selectCurrentTask,
  selectCurrentTaskFromOpen,
  selectTodayProgress,
  selectUpcomingTasks,
  selectUpcomingTasksFromOpen,
} from '../selectWorkerHome';
import { workerHomeEmptyFixture, workerHomeSuccessFixture } from '../fixtures';
import type { WorkerHomePayload } from '../api';
import type { TaskListItem } from '@/features/tasks/api';

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

  it('selectCurrentTaskFromOpen prefers in-progress then high priority', () => {
    const open = [
      { ...workerHomeSuccessFixture.todaysTasks[0]!, id: 'a', status: 'READY', priority: 'NORMAL' },
      { ...workerHomeSuccessFixture.todaysTasks[0]!, id: 'b', status: 'IN_PROGRESS', priority: 'LOW' },
      { ...workerHomeSuccessFixture.todaysTasks[0]!, id: 'c', status: 'READY', priority: 'HIGH' },
    ];
    expect(selectCurrentTaskFromOpen(open)?.id).toBe('b');
    const withoutActive = open.filter((t) => t.id !== 'b');
    expect(selectCurrentTaskFromOpen(withoutActive)?.id).toBe('c');
    expect(selectUpcomingTasksFromOpen(open).map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('maps TaskListItem into WorkerHomeTask for home cards', () => {
    const item = {
      id: 'task-1',
      number: 'PT-1',
      name: 'Packaging',
      status: 'READY',
      priority: 'HIGH',
      plannedCompletion: '2026-08-27T12:00:00.000Z',
      estimatedMinutes: 30,
      salesOrderNumber: 'SO-2026-00021',
      productImageUrl: 'https://example.com/p.png',
      productionOrder: {
        id: 'po-1',
        number: 'PO-1',
        productDescription: 'Armchair',
        product: {
          nameEn: 'Armchair Club',
          nameAr: null,
          nameHe: null,
          imageUrl: 'https://example.com/p.png',
        },
      },
      stageDefinition: {
        code: 'PACKAGING',
        nameEn: 'Packaging',
        nameAr: null,
        nameHe: null,
      },
    } as TaskListItem;
    const mapped = mapTaskListItemToWorkerHomeTask(item);
    expect(mapped.id).toBe('task-1');
    expect(mapped.orderNumber).toBe('SO-2026-00021');
    expect(mapped.productTitle).toBe('Armchair Club');
    expect(mapped.status).toBe('READY');
    expect(mapped.estimatedMinutes).toBe(30);
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
